"""
LDAP authentication service.

Performs a search-bind flow:
  1. Bind to LDAP as a service account (or anonymously) to locate the user's DN
     by email using LDAP_USER_SEARCH_FILTER.
  2. Re-bind as the located DN with the supplied password to verify credentials.
  3. Return the user's email and display name from LDAP attributes.

Raises ValueError on any failure (invalid credentials, server down, user not
found, LDAP disabled). The caller is responsible for translating these into the
GraphQL error surface.
"""
from __future__ import annotations

from typing import Dict

from app.config import settings

try:
    from ldap3 import Server, Connection, ALL, SUBTREE, Tls
    from ldap3.core.exceptions import LDAPException
    import ssl
    _LDAP_AVAILABLE = True
except ImportError:  # pragma: no cover
    _LDAP_AVAILABLE = False


def _ensure_enabled() -> None:
    if not settings.LDAP_ENABLED:
        raise ValueError("La autenticación LDAP está deshabilitada en este servidor.")
    if not _LDAP_AVAILABLE:
        raise ValueError("Falta la dependencia 'ldap3' en el backend.")


def _build_server() -> "Server":
    tls = None
    if settings.LDAP_USE_TLS:
        tls = Tls(validate=ssl.CERT_NONE)
    return Server(
        settings.LDAP_SERVER,
        use_ssl=settings.LDAP_USE_TLS,
        tls=tls,
        get_info=ALL,
    )


def authenticate_ldap(email: str, password: str) -> Dict[str, str]:
    """
    Validate the (email, password) pair against the configured LDAP directory.

    Returns a dict with 'email' and 'name' on success. Raises ValueError on
    any kind of failure — never returns a falsy/empty result.
    """
    _ensure_enabled()

    email_clean = (email or "").strip()
    if not email_clean or not password:
        raise ValueError("Correo y contraseña son obligatorios.")

    server = _build_server()
    search_filter = settings.LDAP_USER_SEARCH_FILTER.replace("{email}", email_clean)

    # Step 1: service bind (or anonymous) to locate the user DN.
    try:
        if settings.LDAP_BIND_USER:
            search_conn = Connection(
                server,
                user=settings.LDAP_BIND_USER,
                password=settings.LDAP_BIND_PASSWORD,
                auto_bind=True,
            )
        else:
            search_conn = Connection(server, auto_bind=True)
    except LDAPException as exc:
        raise ValueError(f"No se pudo contactar el servidor LDAP: {exc}") from exc

    try:
        search_conn.search(
            search_base=settings.LDAP_BASE_DN,
            search_filter=search_filter,
            search_scope=SUBTREE,
            attributes=[settings.LDAP_EMAIL_ATTR, settings.LDAP_NAME_ATTR],
        )
        if not search_conn.entries:
            raise ValueError("Usuario LDAP no encontrado.")
        entry = search_conn.entries[0]
        user_dn = entry.entry_dn
        try:
            ldap_email = str(entry[settings.LDAP_EMAIL_ATTR].value)
        except Exception:
            ldap_email = email_clean
        try:
            ldap_name = str(entry[settings.LDAP_NAME_ATTR].value)
        except Exception:
            ldap_name = ""
    finally:
        try:
            search_conn.unbind()
        except Exception:
            pass

    # Step 2: re-bind as the located DN with the supplied password.
    try:
        user_conn = Connection(server, user=user_dn, password=password, auto_bind=True)
    except LDAPException as exc:
        raise ValueError("Credenciales LDAP inválidas.") from exc

    try:
        user_conn.unbind()
    except Exception:
        pass

    return {"email": ldap_email.lower(), "name": ldap_name}
