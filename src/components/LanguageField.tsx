import { useMemo, useState } from 'react';
import { COMMON_LANGUAGES } from '../lib/languages';
import { LIMITS } from '../lib/validation';
import { valueOf } from './fields';

const OTHER = '__other__';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Languages the user already uses; offered in addition to the common ones. */
  usedLanguages: string[];
}

/**
 * A select with common languages (large touch targets, no typing on mobile)
 * plus "Andere Sprache …" for free text. Option values are URI-encoded because
 * select values must not contain spaces.
 */
export function LanguageField({ label, value, onChange, usedLanguages }: Props) {
  const options = useMemo(() => {
    const set = new Set([...usedLanguages, ...COMMON_LANGUAGES]);
    return [...set].sort((a, b) => a.localeCompare(b, 'de'));
  }, [usedLanguages]);

  const [custom, setCustom] = useState(() => value !== '' && !options.includes(value));
  const showCustom = custom || (value !== '' && !options.includes(value));

  return (
    <div className="wa-stack wa-gap-xs">
      <wa-select
        label={label}
        size="l"
        required={!showCustom}
        value={showCustom ? OTHER : value ? encodeURIComponent(value) : ''}
        placeholder="Sprache wählen"
        onInput={(e) => {
          const raw = valueOf(e);
          if (raw === OTHER) {
            setCustom(true);
            onChange('');
          } else {
            setCustom(false);
            onChange(decodeURIComponent(raw));
          }
        }}
      >
        {options.map((language) => (
          <wa-option key={language} value={encodeURIComponent(language)}>
            {language}
          </wa-option>
        ))}
        <wa-divider></wa-divider>
        <wa-option value={OTHER}>Andere Sprache …</wa-option>
      </wa-select>
      {showCustom ? (
        <wa-input
          label={`${label} (eigene)`}
          size="l"
          required
          maxlength={LIMITS.language}
          autocapitalize="words"
          value={value}
          onInput={(e) => onChange(valueOf(e))}
        ></wa-input>
      ) : null}
    </div>
  );
}
