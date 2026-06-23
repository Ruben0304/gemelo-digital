'use client';

import { useEffect, useState } from 'react';
import {
    ServerStackIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
    BeakerIcon,
    LockClosedIcon,
} from '@heroicons/react/24/outline';
import { executeQuery, executeMutation } from '@/lib/graphql-client';
import { useToast } from './ToastProvider';

interface LdapConfig {
    enabled: boolean;
    serverUrl: string;
    baseDn: string;
    bindDn: string;
    userSearchFilter: string;
    emailAttr: string;
    nameAttr: string;
    useTls: boolean;
    connectTimeout: number;
    hasBindPassword: boolean;
    updatedAt?: string | null;
}

interface TestResult {
    success: boolean;
    message: string;
    sampleUser?: string | null;
}

const LDAP_CONFIG_FIELDS = `
    enabled
    serverUrl
    baseDn
    bindDn
    userSearchFilter
    emailAttr
    nameAttr
    useTls
    connectTimeout
    hasBindPassword
    updatedAt
`;

const LDAP_CONFIG_QUERY = `query LdapConfig { ldapConfig { ${LDAP_CONFIG_FIELDS} } }`;

const SAVE_LDAP_MUTATION = `
  mutation SaveLdapConfig($input: LdapConfigInput!) {
    saveLdapConfig(input: $input) { ${LDAP_CONFIG_FIELDS} }
  }
`;

const TEST_LDAP_MUTATION = `
  mutation TestLdapConnection($input: LdapConfigInput!) {
    testLdapConnection(input: $input) { success message sampleUser }
  }
`;

const DEFAULTS: LdapConfig = {
    enabled: false,
    serverUrl: 'ldap://localhost:389',
    baseDn: 'dc=cujae,dc=edu,dc=cu',
    bindDn: '',
    userSearchFilter: '(mail={email})',
    emailAttr: 'mail',
    nameAttr: 'cn',
    useTls: false,
    connectTimeout: 5,
    hasBindPassword: false,
    updatedAt: null,
};

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
        >
            <span>
                <span className="block text-sm font-medium text-slate-800">{label}</span>
                {hint && <span className="block text-xs text-slate-500">{hint}</span>}
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[1.375rem]' : 'left-0.5'}`} />
            </span>
        </button>
    );
}

function Field({ label, value, onChange, placeholder, type = 'text', mono = false }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200/50 focus:outline-none ${mono ? 'font-mono' : ''}`}
                autoComplete="off"
            />
        </label>
    );
}

export default function LdapConfigManager() {
    const toast = useToast();
    const [cfg, setCfg] = useState<LdapConfig>(DEFAULTS);
    const [bindPassword, setBindPassword] = useState('');
    const [sampleEmail, setSampleEmail] = useState('');
    const [samplePassword, setSamplePassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [result, setResult] = useState<TestResult | null>(null);

    const update = <K extends keyof LdapConfig>(key: K, value: LdapConfig[K]) =>
        setCfg((prev) => ({ ...prev, [key]: value }));

    useEffect(() => {
        (async () => {
            try {
                const data = await executeQuery<{ ldapConfig: LdapConfig }>(LDAP_CONFIG_QUERY, {}, 'network-only');
                if (data?.ldapConfig) setCfg({ ...DEFAULTS, ...data.ldapConfig });
            } catch (err) {
                console.error('Error cargando configuración LDAP:', err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // El payload del formulario. La contraseña de bind solo se envía si el admin
    // escribió una nueva; vacía = el backend conserva la guardada.
    const buildInput = (extra?: Record<string, unknown>) => ({
        enabled: cfg.enabled,
        serverUrl: cfg.serverUrl,
        baseDn: cfg.baseDn,
        bindDn: cfg.bindDn,
        bindPassword: bindPassword || undefined,
        userSearchFilter: cfg.userSearchFilter,
        emailAttr: cfg.emailAttr,
        nameAttr: cfg.nameAttr,
        useTls: cfg.useTls,
        connectTimeout: Number(cfg.connectTimeout) || 5,
        ...extra,
    });

    const handleSave = async () => {
        setSaving(true);
        try {
            const data = await executeMutation<{ saveLdapConfig: LdapConfig }>(SAVE_LDAP_MUTATION, { input: buildInput() });
            if (data?.saveLdapConfig) setCfg({ ...DEFAULTS, ...data.saveLdapConfig });
            setBindPassword('');
            toast.success('Configuración LDAP guardada.');
        } catch (err) {
            console.error('Error guardando configuración LDAP:', err);
            toast.error(err instanceof Error ? err.message : 'No se pudo guardar la configuración.');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setResult(null);
        try {
            const data = await executeMutation<{ testLdapConnection: TestResult }>(TEST_LDAP_MUTATION, {
                input: buildInput({ sampleEmail: sampleEmail || undefined, samplePassword: samplePassword || undefined }),
            });
            setResult(data.testLdapConnection);
        } catch (err) {
            console.error('Error probando conexión LDAP:', err);
            setResult({ success: false, message: err instanceof Error ? err.message : 'Fallo al probar la conexión.' });
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-40 items-center justify-center">
                <ArrowPathIcon className="h-7 w-7 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2">
                    <ServerStackIcon className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Autenticación LDAP</h3>
                    <p className="text-sm text-slate-500">
                        Conexión con el directorio institucional. La pestaña de acceso LDAP solo aparece si está habilitada.
                    </p>
                </div>
            </div>

            <div className="space-y-5">
                <Toggle
                    checked={cfg.enabled}
                    onChange={(v) => update('enabled', v)}
                    label="Habilitar inicio de sesión LDAP"
                    hint="Permite a los usuarios autenticarse con sus credenciales institucionales."
                />

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="URL del servidor" value={cfg.serverUrl} onChange={(v) => update('serverUrl', v)} placeholder="ldap://host:389" mono />
                    <Field label="Base DN" value={cfg.baseDn} onChange={(v) => update('baseDn', v)} placeholder="dc=cujae,dc=edu,dc=cu" mono />
                    <Field label="Bind DN (cuenta de servicio)" value={cfg.bindDn} onChange={(v) => update('bindDn', v)} placeholder="cn=svc,dc=cujae,dc=edu,dc=cu — vacío = anónimo" mono />
                    <Field
                        label={`Contraseña de bind${cfg.hasBindPassword ? ' (hay una guardada)' : ''}`}
                        value={bindPassword}
                        onChange={setBindPassword}
                        placeholder={cfg.hasBindPassword ? '•••••••• (sin cambios)' : 'Contraseña de la cuenta de servicio'}
                        type="password"
                    />
                    <Field label="Filtro de búsqueda" value={cfg.userSearchFilter} onChange={(v) => update('userSearchFilter', v)} placeholder="(mail={email})" mono />
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Atributo de correo" value={cfg.emailAttr} onChange={(v) => update('emailAttr', v)} placeholder="mail" mono />
                        <Field label="Atributo de nombre" value={cfg.nameAttr} onChange={(v) => update('nameAttr', v)} placeholder="cn" mono />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Toggle checked={cfg.useTls} onChange={(v) => update('useTls', v)} label="Usar TLS / LDAPS" hint="Cifra la conexión (servidor con ldaps:// o StartTLS)." />
                    <Field label="Timeout de conexión (s)" value={String(cfg.connectTimeout)} onChange={(v) => update('connectTimeout', Number(v) || 5)} type="number" />
                </div>

                {/* Probar conexión */}
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <BeakerIcon className="h-4 w-4 text-indigo-500" />
                        Probar conexión
                    </div>
                    <p className="mb-3 text-xs text-slate-500">
                        Opcional: introduce un correo y contraseña de un usuario real del directorio para validar el inicio de sesión completo de extremo a extremo.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Correo de prueba (opcional)" value={sampleEmail} onChange={setSampleEmail} placeholder="usuario@cujae.edu.cu" />
                        <Field label="Contraseña de prueba (opcional)" value={samplePassword} onChange={setSamplePassword} type="password" />
                    </div>
                    <button
                        type="button"
                        onClick={handleTest}
                        disabled={testing}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                    >
                        {testing ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <BeakerIcon className="h-4 w-4" />}
                        Probar conexión
                    </button>

                    {result && (
                        <div
                            className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${result.success
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-red-200 bg-red-50 text-red-700'}`}
                        >
                            {result.success ? <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />}
                            <span>
                                {result.message}
                                {result.sampleUser && <span className="block text-xs opacity-80">Usuario verificado: {result.sampleUser}</span>}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                    <p className="flex items-center gap-1.5 text-xs text-slate-400">
                        <LockClosedIcon className="h-3.5 w-3.5" />
                        La contraseña de bind se guarda cifrada y nunca se devuelve al navegador.
                    </p>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
                    >
                        {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />}
                        Guardar configuración
                    </button>
                </div>
            </div>
        </div>
    );
}
