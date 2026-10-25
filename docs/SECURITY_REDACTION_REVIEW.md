# Proposta di revisione della redazione dei segreti

Documento di proposta: `src/security.ts` non è stato modificato.

## Problemi principali

- `safeText` ignora `max` e non rimuove più i caratteri di controllo.
- Il callback ripete il riconoscimento già effettuato dalle regex; `groups` non viene usato.
- Le assegnazioni JSON con chiavi tra virgolette non vengono riconosciute correttamente.
- I valori con virgolette escaped, i token GitHub fine-grained e le credenziali temporanee AWS meritano una gestione esplicita.
- Le soglie minime possono lasciare visibili credenziali brevi, soprattutto nei Bearer.

## Implementazione proposta

Assocerei ogni regex al suo replacement. Redigerei sempre prima di troncare: altrimenti un token tagliato potrebbe non essere più riconoscibile.

```ts
const REDACTED = "[REDACTED]";

type Rule = Readonly<{ pattern: RegExp; replacement: string }>;

const rules: readonly Rule[] = [
  {
    // In caso di blocco incompleto, oscura tutto il resto del testo.
    pattern: /-----BEGIN ([A-Z ]*PRIVATE KEY)-----[\s\S]*?(?:-----END \1-----|$)/g,
    replacement: REDACTED
  },
  {
    pattern: /\bsk-[a-zA-Z0-9_-]{16,}(?![a-zA-Z0-9_-])/g,
    replacement: REDACTED
  },
  {
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: REDACTED
  },
  {
    pattern: /\b(?:gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,})(?![a-zA-Z0-9_])/g,
    replacement: REDACTED
  },
  {
    pattern: /\b(Bearer[ \t]+)[a-zA-Z0-9._~+\/-]+=*/gi,
    replacement: `$1${REDACTED}`
  },
  {
    // Conserva chiave, separatore e delimitatori del valore.
    // Le chiavi possono essere quotate; nei valori gestisce gli escape.
    pattern: /(?<![\w-])((?:(["'`])(?:api[_-]?key|password|passwd|secret|client[_-]?secret|access[_-]?token|refresh[_-]?token|authorization)\2|(?:api[_-]?key|password|passwd|secret|client[_-]?secret|access[_-]?token|refresh[_-]?token|authorization))(?=[ \t]*[:=])[ \t]*[:=][ \t]*)(["'`])(?:\\[^\r\n]|(?!\3)[^\\\r\n])*\3/gi,
    replacement: `$1$3${REDACTED}$3`
  }
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const { pattern, replacement } of rules) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function safeText(text: string, max = 1200): string {
  const limit = Number.isFinite(max)
    ? Math.max(0, Math.floor(max))
    : 1200;

  return redactSecrets(text)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .slice(0, limit);
}
```

## Limiti e scelte progettuali

Questa rimane una difesa euristica, non una garanzia di assenza di segreti.

- Le assegnazioni non quotate, i valori multilinea, le credenziali codificate e i formati sconosciuti richiedono altre regole o un trattamento strutturato.
- Per JSON valido preferirei un redattore ricorsivo basato sui nomi delle chiavi, prima della serializzazione: permette di oscurare l'intero valore senza interpretarlo tramite regex.
- Per header HTTP oscurerei esplicitamente Authorization, Cookie e gli altri header sensibili, anziché affidarmi solo al riconoscimento Bearer.
- Oscurare tutto dopo un blocco PEM incompleto può nascondere testo innocuo: è una scelta conservativa.
- `max` limita l'output, non la memoria o il tempo impiegati a elaborare l'input. Occorrono limiti anche alla fonte, senza esporre frammenti non redatti.
- `slice` conta unità UTF-16, non byte o caratteri visivi, e può separare una coppia surrogata. Se serve un limite in byte occorre una diversa implementazione.
- La regex delle assegnazioni è più complessa: se aumentano i formati supportati, meglio separare i casi o usare un parser invece di continuare ad ampliarla.
- I rilevatori generici di alta entropia possono aiutare, ma generano falsi positivi e non devono essere l'unica difesa.

## Test da aggiungere prima dell'integrazione

Usare solo valori sintetici, mai credenziali reali.

1. Chiavi JSON e assegnazioni con apici singoli, doppi e backtick.
2. Valori con virgolette escaped e backslash.
3. Più segreti nella stessa stringa e chiamate ripetute.
4. Bearer brevi, con padding e con diversa capitalizzazione.
5. Prefissi OpenAI, AWS temporanei e GitHub fine-grained; suffissi '-' e '_'.
6. Blocchi PEM completi, incompleti e multipli.
7. `max` omesso, zero, negativo, frazionario, NaN e infinito.
8. Rimozione dei caratteri di controllo, conservando tab e newline.
9. Nessun frammento di credenziale al confine di troncamento.
10. Testo ordinario invariato e idempotenza della redazione.
11. Input lunghi e malformati per valutare prestazioni e falsi positivi.

## Stato della verifica

La proposta non è stata compilata né eseguita. Prima di integrarla vanno verificati compatibilità con il runtime del progetto, casi limite e prestazioni. Non sono stati modificati codice applicativo, dipendenze o versione del pacchetto.
