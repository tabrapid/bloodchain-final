'use client';

import { useId, useState } from 'react';
import { partnershipEmail } from './site-config';
import { Icon } from './icons';

export function PartnershipForm() {
  const id = useId();
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [contactError, setContactError] = useState('');
  const mailto = `mailto:${partnershipEmail}?subject=${encodeURIComponent('BloodChain — muassasa hamkorligi')}&body=${encodeURIComponent(draft)}`;

  return (
    <form
      className="partnership-form"
      onChange={(event) => {
        if (event.target instanceof HTMLInputElement) event.target.setCustomValidity('');
        setDraft('');
        setCopied(false);
        setCopyError(false);
        setContactError('');
      }}
      onSubmit={(event) => {
        event.preventDefault();
        for (const name of ['institution', 'city', 'person']) {
          const field = event.currentTarget.querySelector<HTMLInputElement>(`[name="${name}"]`);
          if (field && field.value.trim().length < 2) {
            field.setCustomValidity('Kamida ikki mazmunli belgi kiriting.');
            field.reportValidity();
            return;
          }
        }
        const data = new FormData(event.currentTarget);
        const contact = String(data.get('contact') ?? '').trim();
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) &&
          !(/^\+?[\d\s()-]{7,25}$/.test(contact) && contact.replace(/\D/g, '').length >= 7)
        ) {
          setContactError('Telefon raqami yoki to‘g‘ri email manzilini kiriting.');
          event.currentTarget.querySelector<HTMLInputElement>('[name="contact"]')?.focus();
          return;
        }
        const fields = [
          ['Muassasa nomi', 'institution'],
          ['Muassasa turi', 'type'],
          ['Viloyat', 'region'],
          ['Shahar / tuman', 'city'],
          ['Mas’ul shaxs', 'person'],
          ['Telefon yoki email', 'contact'],
          ['Qiziqtirgan modul', 'module'],
        ] as const;
        setDraft(
          'Assalomu alaykum! BloodChain bilan hamkorlik masalasida murojaat qilmoqchimiz.\n\n' +
            fields
              .map(([label, name]) => `${label}: ${String(data.get(name) ?? '').trim()}`)
              .join('\n') +
            '\n\nBu murojaat muassasa uchun avtomatik hisob yoki xizmatga ulanish yaratmaydi.',
        );
      }}
    >
      <div className="form-heading">
        <span className="icon-tile">
          <Icon name="building" />
        </span>
        <div>
          <h3>Hamkorlikni boshlaylik</h3>
          <p>Muassasangiz haqida qisqacha ma’lumot qoldiring.</p>
        </div>
      </div>
      <div className="form-grid">
        <label className="full" htmlFor={`${id}-institution`}>
          Muassasa nomi <span aria-hidden="true">*</span>
          <input
            id={`${id}-institution`}
            name="institution"
            required
            minLength={2}
            maxLength={180}
            autoComplete="organization"
            placeholder="Muassasangizning to‘liq nomi"
          />
        </label>
        <label htmlFor={`${id}-type`}>
          Muassasa turi <span aria-hidden="true">*</span>
          <select id={`${id}-type`} name="type" required defaultValue="">
            <option value="" disabled>
              Turini tanlang
            </option>
            <option>Shifoxona / klinika</option>
            <option>Qon markazi</option>
            <option>Laboratoriya</option>
            <option>Hamkor tashkilot</option>
          </select>
        </label>
        <label htmlFor={`${id}-region`}>
          Viloyat / hudud <span aria-hidden="true">*</span>
          <select id={`${id}-region`} name="region" required defaultValue="">
            <option value="" disabled>
              Hududni tanlang
            </option>
            {[
              'Toshkent shahri',
              'Toshkent viloyati',
              'Andijon',
              'Buxoro',
              'Farg‘ona',
              'Jizzax',
              'Namangan',
              'Navoiy',
              'Qashqadaryo',
              'Qoraqalpog‘iston Respublikasi',
              'Samarqand',
              'Sirdaryo',
              'Surxondaryo',
              'Xorazm',
            ].map((region) => (
              <option key={region}>{region}</option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-city`}>
          Shahar / tuman <span aria-hidden="true">*</span>
          <input
            id={`${id}-city`}
            name="city"
            required
            minLength={2}
            maxLength={100}
            autoComplete="address-level2"
            placeholder="Shahar yoki tuman"
          />
        </label>
        <label htmlFor={`${id}-person`}>
          Mas’ul shaxs <span aria-hidden="true">*</span>
          <input
            id={`${id}-person`}
            name="person"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            placeholder="Ism va familiya"
          />
        </label>
        <label className="full" htmlFor={`${id}-contact`}>
          Telefon yoki email <span aria-hidden="true">*</span>
          <input
            id={`${id}-contact`}
            name="contact"
            required
            maxLength={180}
            placeholder="+998 … yoki email manzilingiz"
            aria-invalid={!!contactError}
            aria-describedby={contactError ? `${id}-error` : undefined}
          />
        </label>
        {contactError && (
          <p id={`${id}-error`} className="form-error full" role="alert">
            {contactError}
          </p>
        )}
        <label className="full" htmlFor={`${id}-module`}>
          Qiziqtirgan modul <span aria-hidden="true">*</span>
          <select id={`${id}-module`} name="module" required defaultValue="">
            <option value="" disabled>
              Modulni tanlang
            </option>
            <option>Shifoxona portali</option>
            <option>Qon markazi portali</option>
            <option>Donorlik va qabullar</option>
            <option>Laboratoriya va kuzatuvchanlik</option>
            <option>Umumiy hamkorlik</option>
          </select>
        </label>
      </div>
      <p className="form-note">
        Ma’lumotlar shu sahifada qoralama tayyorlash uchun ishlatiladi. Email dasturini ochib,
        yuborishni o‘zingiz tasdiqlaysiz. Tibbiy yoki bemor ma’lumotlarini kiritmang.
      </p>
      <button className="button" type="submit">
        Murojaatni tayyorlash <Icon name="arrow" size={18} />
      </button>
      {draft && (
        <div className="draft-panel" role="region" aria-label="Hamkorlik murojaati qoralamasi">
          <p className="draft-status" role="status">
            <Icon name="check" size={18} /> Qoralama tayyor. Hali yuborilmadi.
          </p>
          <label htmlFor={`${id}-draft`}>
            Email matni
            <textarea id={`${id}-draft`} readOnly value={draft} rows={7} />
          </label>
          <p className="draft-recipient">
            Qabul qiluvchi: <strong>{partnershipEmail}</strong>
          </p>
          <div className="actions">
            <a className="button" href={mailto}>
              Email dasturida ochish <Icon name="arrow" size={16} />
            </a>
            <button
              className="button secondary"
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(draft);
                  setCopied(true);
                  setCopyError(false);
                } catch {
                  setCopyError(true);
                }
              }}
            >
              {copied ? 'Nusxalandi' : 'Matnni nusxalash'}
            </button>
          </div>
          {copyError && (
            <p role="status">
              Avtomatik nusxalab bo‘lmadi. Yuqoridagi matnni belgilab, qo‘lda nusxalang.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
