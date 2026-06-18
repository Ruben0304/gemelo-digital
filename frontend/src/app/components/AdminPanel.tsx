'use client';

import { useState, useEffect } from 'react';
import { executeQuery, executeMutation } from '@/lib/graphql-client';
import { User } from '@/types';
import {
    UserGroupIcon,
    KeyIcon,
    ClipboardDocumentCheckIcon,
    ArrowPathIcon,
    PlusIcon,
    CheckIcon,
    ArrowLeftIcon,
    ArrowRightOnRectangleIcon,
    TrashIcon,
    ComputerDesktopIcon,
    DevicePhoneMobileIcon,
    SignalSlashIcon,
} from '@heroicons/react/24/outline';

interface AdminPanelProps {
    currentUser: User;
    onBack?: () => void;
    onLogout?: () => void;
}

interface InvitationCode {
    _id: string;
    code: string;
    role: string;
    isUsed: boolean;
    createdBy?: string;
    usedBy?: string;
    createdAt?: string;
}

interface ActiveSession {
    _id: string;
    email: string;
    ip: string;
    userAgent: string;
    deviceType: string;
    createdAt?: string;
    expiresAt?: string;
}

const ADMIN_DATA_QUERY = `
  query AdminData {
    users {
      _id
      email
      name
      role
      createdAt
    }
    invitationCodes {
      _id
      code
      role
      isUsed
      createdBy
      usedBy
      createdAt
    }
    activeSessions {
      _id
      email
      ip
      deviceType
      createdAt
    }
  }
`;

const REVOKE_SESSION_MUTATION = `
  mutation RevokeSession($id: String!) {
    revokeSession(id: $id)
  }
`;

const DELETE_USER_MUTATION = `
  mutation DeleteUser($id: String!) {
    deleteUser(id: $id)
  }
`;

const GENERATE_CODE_MUTATION = `
  mutation GenerateCode($role: String!, $createdBy: String!) {
    generateInvitationCode(role: $role, createdBy: $createdBy) {
      _id
      code
      role
      isUsed
      createdAt
    }
  }
`;

export default function AdminPanel({ currentUser, onBack, onLogout }: AdminPanelProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [codes, setCodes] = useState<InvitationCode[]>([]);
    const [sessions, setSessions] = useState<ActiveSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [genError, setGenError] = useState<string | null>(null);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

    useEffect(() => {
        if (!copiedCode) return;
        const t = setTimeout(() => setCopiedCode(null), 1500);
        return () => clearTimeout(t);
    }, [copiedCode]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await executeQuery<{
                users: User[];
                invitationCodes: InvitationCode[];
                activeSessions: ActiveSession[];
            }>(ADMIN_DATA_QUERY, {}, 'network-only');
            setUsers(data.users);
            setCodes(data.invitationCodes);
            setSessions(data.activeSessions ?? []);
        } catch (error) {
            console.error('Error fetching admin data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRevokeSession = async (id: string) => {
        setRevokingId(id);
        const isOwn = sessions.find((s) => s._id === id)?.email === currentUser.email;
        try {
            await executeMutation(REVOKE_SESSION_MUTATION, { id });
            if (isOwn) {
                onLogout?.();
                return;
            }
            setSessions((prev) => prev.filter((s) => s._id !== id));
        } catch (err) {
            console.error('Error al revocar sesión:', err);
        } finally {
            setRevokingId(null);
        }
    };

    const handleDeleteUser = async (id: string) => {
        setDeletingUserId(id);
        try {
            await executeMutation(DELETE_USER_MUTATION, { id });
            await fetchData();
        } catch (err) {
            console.error('Error al eliminar usuario:', err);
        } finally {
            setDeletingUserId(null);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleGenerateCode = async () => {
        setGenerating(true);
        setGenError(null);
        try {
            await executeMutation(GENERATE_CODE_MUTATION, {
                role: newRole,
                createdBy: currentUser.email,
            });
            await fetchData();
        } catch (error) {
            console.error('Error generating code:', error);
            setGenError('No se pudo generar el código.');
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedCode(text);
        } catch {
            /* si el portapapeles no está disponible, no rompemos la UI */
        }
    };

    if (loading && users.length === 0) {
        return (
            <div className="flex h-96 items-center justify-center">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {onBack && (
                <button
                    onClick={onBack}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Atrás
                </button>
            )}

            {/* Invitation Codes Section */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-50 p-2">
                            <KeyIcon className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">Códigos de Invitación</h3>
                            <p className="text-sm text-slate-500">Generar nuevos accesos para operadores o administradores</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
                        <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                            className="bg-transparent px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none"
                        >
                            <option value="user">Rol: Operador</option>
                            <option value="admin">Rol: Admin</option>
                        </select>
                        <button
                            onClick={handleGenerateCode}
                            disabled={generating}
                            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
                        >
                            {generating ? (
                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                                <PlusIcon className="h-4 w-4" />
                            )}
                            Generar
                        </button>
                    </div>
                </div>

                {genError && (
                    <p className="mb-4 text-sm text-red-600">{genError}</p>
                )}

                <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                            <tr>
                                <th className="px-4 py-3 font-medium">Código</th>
                                <th className="px-4 py-3 font-medium">Rol Asignado</th>
                                <th className="px-4 py-3 font-medium">Estado</th>
                                <th className="px-4 py-3 font-medium">Creado por</th>
                                <th className="px-4 py-3 font-medium">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {codes.map((code) => (
                                <tr key={code._id} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-3 font-mono font-medium text-slate-700">
                                        <button
                                            onClick={() => copyToClipboard(code.code)}
                                            className="group flex items-center gap-2 hover:text-blue-600"
                                            title="Copiar código"
                                        >
                                            {code.code}
                                            {copiedCode === code.code ? (
                                                <span className="animate-check-pop inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                                    <CheckIcon className="h-4 w-4" />
                                                    Copiado
                                                </span>
                                            ) : (
                                                <ClipboardDocumentCheckIcon className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${code.role === 'admin'
                                                ? 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20'
                                                : 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20'
                                                }`}
                                        >
                                            {code.role === 'admin' ? 'Administrador' : 'Operador'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${code.isUsed
                                                ? 'bg-slate-100 text-slate-600'
                                                : 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
                                                }`}
                                        >
                                            {code.isUsed ? 'Usado' : 'Activo'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">{code.createdBy}</td>
                                    <td className="px-4 py-3 text-slate-500">
                                        {code.createdAt ? new Date(code.createdAt).toLocaleDateString() : '-'}
                                    </td>
                                </tr>
                            ))}
                            {codes.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                        No hay códigos generados aún.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sessions Section */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center gap-3">
                    <div className="rounded-lg bg-emerald-50 p-2">
                        <ComputerDesktopIcon className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">Sesiones activas</h3>
                        <p className="text-sm text-slate-500">Usuarios conectados en este momento — puede cerrar cualquier sesión</p>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                            <tr>
                                <th className="px-4 py-3 font-medium">Usuario</th>
                                <th className="px-4 py-3 font-medium">IP</th>
                                <th className="px-4 py-3 font-medium">Dispositivo</th>
                                <th className="px-4 py-3 font-medium">Inicio</th>
                                <th className="px-4 py-3 font-medium"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {sessions.map((s) => (
                                <tr key={s._id} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-3 font-medium text-slate-900">
                                        <span className="flex items-center gap-2">
                                            {s.email}
                                            {s.email === currentUser.email && (
                                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">tú</span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.ip || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                                            {s.deviceType === 'Móvil'
                                                ? <DevicePhoneMobileIcon className="h-4 w-4 text-slate-400" />
                                                : <ComputerDesktopIcon className="h-4 w-4 text-slate-400" />}
                                            {s.deviceType}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">
                                        {s.createdAt ? new Date(s.createdAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleRevokeSession(s._id)}
                                            disabled={revokingId === s._id}
                                            title="Cerrar sesión"
                                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                        >
                                            {revokingId === s._id
                                                ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                                                : <SignalSlashIcon className="h-3.5 w-3.5" />}
                                            Cerrar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {sessions.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                        No hay sesiones activas registradas.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Users Section */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center gap-3">
                    <div className="rounded-lg bg-slate-100 p-2">
                        <UserGroupIcon className="h-6 w-6 text-slate-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">Usuarios Registrados</h3>
                        <p className="text-sm text-slate-500">Listado de personal con acceso al sistema</p>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                            <tr>
                                <th className="px-4 py-3 font-medium">Nombre</th>
                                <th className="px-4 py-3 font-medium">Email</th>
                                <th className="px-4 py-3 font-medium">Rol</th>
                                <th className="px-4 py-3 font-medium">Fecha Registro</th>
                                <th className="px-4 py-3 font-medium"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {users.map((user) => (
                                <tr key={user._id} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-3 font-medium text-slate-900">{user.name || '-'}</td>
                                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${user.role === 'admin'
                                                ? 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20'
                                                : 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-600/20'
                                                }`}
                                        >
                                            {user.role === 'admin' ? 'Administrador' : 'Operador'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {user.email !== currentUser.email && (
                                            <button
                                                onClick={() => handleDeleteUser(user._id!)}
                                                disabled={deletingUserId === user._id}
                                                title="Eliminar cuenta"
                                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                            >
                                                {deletingUserId === user._id
                                                    ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                                                    : <TrashIcon className="h-3.5 w-3.5" />}
                                                Eliminar
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Zona de cierre de sesión */}
            {onLogout && (
                <div className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-red-700">Cerrar sesión</h3>
                            <p className="mt-0.5 text-sm text-red-600/80">
                                Se cerrará tu sesión en este dispositivo. Tendrás que volver a iniciar sesión para acceder.
                            </p>
                        </div>
                        <button
                            onClick={onLogout}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-600 hover:bg-red-600 hover:text-white"
                        >
                            <ArrowRightOnRectangleIcon className="h-4 w-4" />
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
