'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, RotateCw, Inbox } from 'lucide-react';
export const date = (value?: string) =>
  value
    ? new Date(value).toLocaleString('uz-UZ', {
        timeZone: 'Asia/Tashkent',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '—';
export function useResource<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const revision = useRef(0);
  const reload = useCallback(async () => {
    const current = ++revision.current;
    setLoading(true);
    setError('');
    try {
      const result = await loader();
      if (current === revision.current) setData(result);
    } catch (e) {
      if (current === revision.current)
        setError(e instanceof Error ? e.message : 'So‘rov bajarilmadi');
    } finally {
      if (current === revision.current) setLoading(false);
    }
  }, [loader]);
  const invalidate = useCallback(() => {
    revision.current++;
  }, []);
  useEffect(() => {
    void reload();
    return invalidate;
  }, [reload, invalidate]);
  return { data, error, loading, reload };
}
export function Resource({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
  children: ReactNode;
}) {
  if (loading)
    return (
      <div className="donor-loading" role="status">
        <RotateCw className="animate-spin" size={22} /> Ma’lumot yuklanmoqda…
      </div>
    );
  if (error)
    return (
      <div className="donor-error" role="alert">
        <AlertCircle size={20} />
        <p>{error}</p>
        <button onClick={retry}>Qayta urinish</button>
      </div>
    );
  return <>{children}</>;
}
export function Empty({ children = 'Hozircha ma’lumot mavjud emas.' }: { children?: ReactNode }) {
  return (
    <div className="donor-empty">
      <Inbox size={28} />
      <p>{children}</p>
    </div>
  );
}
export function Panel({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="donor-panel">
      <header>
        <h2>{title}</h2>
        {actions}
      </header>
      <div className="donor-panel-body">{children}</div>
    </section>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="donor-badge">{children}</span>;
}
export function Action({
  children,
  onClick,
  danger = false,
  confirm,
}: {
  children: ReactNode;
  onClick: () => Promise<unknown>;
  danger?: boolean;
  confirm?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <span className="donor-action">
      <button
        className={danger ? 'danger' : ''}
        disabled={busy}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setBusy(true);
          setError('');
          try {
            await onClick();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Amal bajarilmadi');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Bajarilmoqda…' : children}
      </button>
      {error && (
        <span role="alert" className="error-text">
          {error}
        </span>
      )}
    </span>
  );
}
export function FormMessage({ error, success }: { error?: string; success?: string }) {
  return (
    <>
      {error && (
        <p role="alert" className="donor-error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="donor-success">
          {success}
        </p>
      )}
    </>
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="donor-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
