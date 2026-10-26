import { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, Link2, PencilLine, Search } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { cachedDrug, ingredientText, useDrugInfo } from '../api/drugs.js';
import { useDebounced } from '../app/hooks.js';
import { foldVN } from '../lib/text.js';
import { Spinner } from './ui.jsx';

function Highlight({ text, query }) {
  const q = foldVN(query);
  const folded = foldVN(text);
  const at = q ? folded.indexOf(q) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

/**
 * Ô nhập tên thuốc: gợi ý từ danh mục khi gõ từ 2 ký tự (FR-05), luôn cho phép giữ
 * tên tự do đúng như trên đơn (BR-04, luồng 2a); danh mục lỗi thì vẫn nhập được (E3).
 */
export default function DrugAutocomplete({ value, onChange, error, inputId }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [search, setSearch] = useState({ query: '', results: [], failure: null, loading: false });
  const wrapRef = useRef(null);
  const text = value.drugNameRaw || '';
  const query = useDebounced(text, 200);
  useDrugInfo([value.drugId]);

  // Chỉ tra danh mục khi ô đang mở và đã gõ đủ 2 ký tự (FR-05).
  useEffect(() => {
    const q = query.trim();
    if (!open || foldVN(q).length < 2) {
      setSearch({ query: q, results: [], failure: null, loading: false });
      return undefined;
    }
    let alive = true;
    setSearch((s) => ({ ...s, loading: true }));
    api.searchDrugs(q, 8).then(
      (results) => alive && setSearch({ query: q, results, failure: null, loading: false }),
      (failure) => alive && setSearch({ query: q, results: [], failure, loading: false })
    );
    return () => {
      alive = false;
    };
  }, [query, open]);
  const { results, failure } = search;

  const showFree = foldVN(text).length >= 2 && !results.some((d) => foldVN(d.brandName) === foldVN(text));
  const options = [...results.map((d) => ({ type: 'drug', drug: d })), ...(showFree ? [{ type: 'free' }] : [])];
  const expanded = open && foldVN(text).length >= 2 && (options.length > 0 || failure);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function choose(option) {
    if (!option) return;
    if (option.type === 'drug') {
      onChange({ drugId: option.drug.id, drugNameRaw: option.drug.brandName });
    } else {
      onChange({ drugId: null, drugNameRaw: text.trim() });
    }
    setOpen(false);
  }

  function onKeyDown(e) {
    if (!expanded) {
      if (e.key === 'ArrowDown' && foldVN(text).length >= 2) setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const linked = value.drugId ? cachedDrug(value.drugId) : null;

  return (
    <div className="drug-ac" ref={wrapRef}>
      <div className="input-with-icon">
        {search.loading ? <Spinner label="Đang tra danh mục" /> : <Search size={16} aria-hidden="true" />}
        <input
          id={inputId}
          className="input"
          type="text"
          role="combobox"
          aria-expanded={Boolean(expanded)}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && options[active] ? `${listId}-${active}` : undefined}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          placeholder="Gõ tên thuốc như trên đơn, ví dụ: Panfor"
          value={text}
          maxLength={200}
          onChange={(e) => {
            onChange({ drugId: null, drugNameRaw: e.target.value });
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>

      {expanded && (
        <ul className="ac-list" id={listId} role="listbox">
          {failure && (
            <li className="ac-note" role="presentation">
              Danh mục thuốc đang không phản hồi. Bạn vẫn có thể giữ tên tự do; dòng thuốc sẽ được đánh dấu để liên kết danh mục sau.
            </li>
          )}
          {options.map((opt, i) => (
            <li
              key={opt.type === 'drug' ? opt.drug.id : 'free'}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`ac-option ${i === active ? 'is-active' : ''} ${opt.type === 'free' ? 'ac-free' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(opt)}
            >
              {opt.type === 'drug' ? (
                <>
                  <span className="ac-name">
                    <span>
                      <Highlight text={opt.drug.brandName} query={query} />
                    </span>
                  </span>
                  <span className="ac-sub">
                    {ingredientText(opt.drug)} · {opt.drug.dosageForm}
                  </span>
                </>
              ) : (
                <>
                  <span className="ac-name">
                    <PencilLine size={14} aria-hidden="true" /> Giữ tên tự do: “{text.trim()}”
                  </span>
                  <span className="ac-sub">Không có trong danh mục — vẫn lưu đúng tên ghi trên đơn</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {value.drugId ? (
        <span className="link-chip is-linked">
          <CheckCircle2 size={13} aria-hidden="true" /> Đã liên kết danh mục{linked ? `: ${ingredientText(linked)}` : ''}
        </span>
      ) : (
        text.trim() && (
          <span className="link-chip">
            <Link2 size={13} aria-hidden="true" /> Tên tự do, chưa liên kết danh mục — chưa kiểm tra được hoạt chất
          </span>
        )
      )}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
