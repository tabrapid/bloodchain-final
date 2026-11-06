import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { useOptionalTranslation } from '../../i18n';

export function ComponentBarcode({ reference }: { reference: string }) {
  const node = useRef<SVGSVGElement>(null);
  const [valid, setValid] = useState(true);
  const { t } = useOptionalTranslation();
  useEffect(() => {
    if (!node.current) return;
    try {
      JsBarcode(node.current, reference, {
        format: 'CODE128',
        width: 1.5,
        height: 42,
        margin: 10,
        displayValue: false,
      });
      setValid(true);
    } catch {
      setValid(false);
    }
  }, [reference]);
  return (
    <figure className="bc-component-barcode">
      <figcaption>{t('workbench.barcode')}</figcaption>
      <svg
        ref={node}
        style={valid ? undefined : { display: 'none' }}
        role="img"
        aria-label={`${t('workbench.barcode')}: ${reference}`}
      />
      <code>{reference}</code>
    </figure>
  );
}
