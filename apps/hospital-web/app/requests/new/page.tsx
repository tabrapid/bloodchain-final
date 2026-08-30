'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Droplet, Plus, Trash2 } from 'lucide-react';
import { me, isAuthenticated, MeResponse } from '../../../lib/auth';
import { createBloodRequest } from '../../../lib/shipments';
import { AppShell } from '../../../components/AppShell';

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'];
const RH_FACTORS = ['POSITIVE', 'NEGATIVE'];
const COMPONENT_TYPES = ['WHOLE_BLOOD', 'RED_CELLS', 'PLASMA', 'PLATELETS', 'OTHER'];
const PRIORITIES = ['ROUTINE', 'URGENT', 'CRITICAL'];

interface RequestItemForm {
  bloodType: string;
  rhFactor: string;
  componentType: string;
  unitsRequested: number;
}

function emptyItem(): RequestItemForm {
  return { bloodType: 'O', rhFactor: 'POSITIVE', componentType: 'WHOLE_BLOOD', unitsRequested: 1 };
}

export default function NewBloodRequestPage() {
  const router = useRouter();

  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const [items, setItems] = useState<RequestItemForm[]>([emptyItem()]);
  const [priority, setPriority] = useState('ROUTINE');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (isAuthenticated()) {
          const userData = await me();
          setUser(userData);
          const hospitalOrg = userData.organizations.find((org) => org.type === 'HOSPITAL');
          if (hospitalOrg) {
            setOrganizationId(hospitalOrg.organizationId);
          }
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  const updateItem = (index: number, patch: Partial<RequestItemForm>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const canSubmit =
    organizationId &&
    items.length > 0 &&
    items.every((item) => item.unitsRequested > 0) &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const request = await createBloodRequest(organizationId, {
        items,
        priority,
        notes: notes.trim() || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        deliveryPhone: deliveryPhone.trim() || undefined,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
      });
      router.push(`/requests/${request.id}`);
    } catch (err) {
      console.error('Failed to create blood request:', err);
      setError(err instanceof Error ? err.message : 'Failed to create blood request');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell
        title="Loading..."
        subtitle="HOSPITAL CONSOLE"
        organizationName="Northstar Hospital (Development)"
        organizationType="Hospital workspace"
        userName="Loading..."
      >
        <div className="flex items-center justify-center p-12">
          <Droplet className="animate-spin text-donor-primary" size={32} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="New Blood Request"
      subtitle="HOSPITAL OPERATIONS"
      organizationName="Northstar Hospital (Development)"
      organizationType="Hospital Console"
      userName={user ? `${user.firstName} ${user.lastName}` : 'Guest'}
    >
      <button
        onClick={() => router.push('/requests')}
        className="mb-4 flex items-center gap-2 text-sm text-donor-muted hover:text-donor-text"
      >
        <ArrowLeft size={16} />
        Back to Blood Requests
      </button>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-donor-text">New Blood Request</h1>
        <p className="text-sm text-donor-muted">
          Request blood units from a blood center. Any active blood center can review and fulfill it.
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        <div className="bc-glass rounded-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-donor-text">Units Needed</h3>
            <button
              onClick={addItem}
              className="flex items-center gap-1 rounded-lg border border-donor-border px-3 py-1.5 text-xs font-semibold text-donor-text hover:bg-donor-border"
            >
              <Plus size={14} />
              Add Line
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_1.4fr_0.9fr_auto] items-end gap-3 rounded-lg border border-donor-border/60 p-3">
                <div>
                  <label className="mb-1 block text-xs text-donor-muted">Blood Type</label>
                  <select
                    value={item.bloodType}
                    onChange={(e) => updateItem(index, { bloodType: e.target.value })}
                    className="w-full rounded-lg border border-donor-border bg-donor-bg px-2 py-2 text-sm text-donor-text"
                  >
                    {BLOOD_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-donor-muted">Rh Factor</label>
                  <select
                    value={item.rhFactor}
                    onChange={(e) => updateItem(index, { rhFactor: e.target.value })}
                    className="w-full rounded-lg border border-donor-border bg-donor-bg px-2 py-2 text-sm text-donor-text"
                  >
                    {RH_FACTORS.map((r) => (
                      <option key={r} value={r}>{r === 'POSITIVE' ? '+' : '-'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-donor-muted">Component</label>
                  <select
                    value={item.componentType}
                    onChange={(e) => updateItem(index, { componentType: e.target.value })}
                    className="w-full rounded-lg border border-donor-border bg-donor-bg px-2 py-2 text-sm text-donor-text"
                  >
                    {COMPONENT_TYPES.map((c) => (
                      <option key={c} value={c}>{c.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-donor-muted">Units</label>
                  <input
                    type="number"
                    min={1}
                    value={item.unitsRequested}
                    onChange={(e) => updateItem(index, { unitsRequested: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full rounded-lg border border-donor-border bg-donor-bg px-2 py-2 text-sm text-donor-text"
                  />
                </div>
                <button
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="rounded-lg p-2 text-donor-muted hover:bg-donor-dangerMuted hover:text-donor-onDangerMuted disabled:opacity-30"
                  title="Remove line"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bc-glass rounded-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-donor-text">Request Details</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-donor-muted">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-donor-border bg-donor-bg px-3 py-2 text-sm text-donor-text"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-donor-muted">Needed By (optional)</label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full rounded-lg border border-donor-border bg-donor-bg px-3 py-2 text-sm text-donor-text"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-donor-muted">Delivery Address (optional)</label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Defaults to hospital address"
                className="w-full rounded-lg border border-donor-border bg-donor-bg px-3 py-2 text-sm text-donor-text"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-donor-muted">Delivery Phone (optional)</label>
              <input
                type="text"
                value={deliveryPhone}
                onChange={(e) => setDeliveryPhone(e.target.value)}
                className="w-full rounded-lg border border-donor-border bg-donor-bg px-3 py-2 text-sm text-donor-text"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-xs text-donor-muted">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-donor-border bg-donor-bg px-3 py-2 text-sm text-donor-text"
              placeholder="Any context that would help the blood center prioritize this request"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-donor-danger/30 bg-donor-dangerMuted px-4 py-3 text-sm text-donor-onDangerMuted">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => router.push('/requests')}
            className="rounded-lg border border-donor-border px-4 py-2 text-sm text-donor-text"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-donor-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
