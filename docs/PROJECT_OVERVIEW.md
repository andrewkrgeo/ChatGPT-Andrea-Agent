# ChatGPT Code Agent — panoramica del progetto

## Che cos’è

ChatGPT Code Agent è un’estensione per Visual Studio Code (MVP 0.5.5) che integra una chat laterale con l’OpenAI Responses API. L’agente può esplorare il workspace, proporre modifiche, eseguire comandi approvati, leggere la diagnostica e mantenere note locali sul progetto.

È scritto in TypeScript e supporta un solo workspace locale. Non è una sandbox: i comandi approvati vengono eseguiti con i permessi del sistema operativo dell’utente.

## Funzionalità

- Vista chat nella Activity Bar, selezione di modello e reasoning effort configurabili.
- Ciclo Responses API con chiamate agli strumenti, cancellazione e reset della catena conversazionale.
- Strumenti `list_files`, `read_file`, `write_file`, `run_command`, `get_command_status`, `stop_command` e `get_diagnostics`.
- I comandi shell approvati partono in background e restituiscono un ID; l’agente può monitorare output e completamento o arrestare un comando tramite ID. Il timeout predefinito è 60 secondi; `timeoutSeconds: 0` lo disattiva per server o watcher da lasciare in esecuzione, arrestabili con `stop_command`.
- Le schede di approvazione per le modifiche mostrano contenuto precedente e proposto e offrono **Open diff editor**; il diff non si apre automaticamente. Un rifiuto impedisce l’esecuzione.
- Contatori di token API per conversazione e sessione, con stime di costo indicative.
- Chiave API conservata in VS Code SecretStorage.
- Memoria locale opzionale: fatti persistenti, registro eventi e riepiloghi per attività.

## Architettura

- `src/extension.ts`: punto d’ingresso; registra vista e comandi, gestisce impostazioni, chiave API, richieste di approvazione e inizializzazione della memoria.
- `src/agent.ts`: coordina le richieste Responses API, i cicli di strumenti, cancellazione, contatori e consolidamento automatico.
- `src/workspaceTools.ts`: implementa gli strumenti file, diagnostica e shell, con controlli di percorso e approvazioni.
- `src/memory.ts`: gestisce i file `.andrea/`, la registrazione eventi e il consolidamento della memoria.
- `src/usage.ts`: aggrega i token e produce stime di costo.
- `media/`: risorse grafiche dell’estensione.

Flusso tipico: messaggio dalla Webview → `CodingAgent` → Responses API → eventuali strumenti locali → risultati all’API → risposta nella chat. Gli strumenti di scrittura e comando richiedono approvazione esplicita. Al termine di una richiesta riuscita, `chatgptAgent.autoConsolidate` (attivo per default) può effettuare una chiamata API aggiuntiva senza strumenti per proporre un breve riepilogo e fatti durevoli.

## Memoria e privacy

I file di memoria si trovano in `.andrea/` nel workspace:

- `SEED.md`: contesto iniziale; viene creato solo se assente e non viene sovrascritto.
- `MEMORY.md`: fatti e convenzioni persistenti; i nuovi fatti possono essere aggiunti senza sostituire le note esistenti.
- `sessions.jsonl`: eventi cronologici, inclusi messaggi utente e risposte dell’agente, oltre a nomi degli strumenti e stato; non salva gli argomenti completi né gli output degli strumenti.
- `summaries.jsonl`: riepiloghi concisi generati dopo attività completate con consolidamento attivo.

La chat non è salvata come trascrizione completa. Tuttavia, il registro può contenere prompt, risposte e informazioni private del progetto: proteggere `.andrea/` e controllarne i contenuti prima di condividere il workspace. I riepiloghi generati dal modello possono essere imprecisi; verificare i fatti importanti. La chiamata di consolidamento comporta costi API aggiuntivi, non inclusi nel contatore d’uso, ed è disattivabile tramite `chatgptAgent.autoConsolidate`.

La chiave API è conservata in SecretStorage. Il contenuto delle richieste viene inviato a OpenAI secondo i relativi termini API. L’estensione non include telemetria esterna.

## Sicurezza e limiti

Le approvazioni sono controlli umani, non isolamento del sistema operativo. I comandi shell approvati possono accedere a file esterni al workspace, modificare dati o usare la rete. Esaminare i comandi prima di approvarli e non eseguire progetti non attendibili. La chiave API viene rimossa dall’ambiente dei comandi avviati dall’estensione, ma altre variabili dell’ambiente utente possono essere ereditate.

Gli strumenti file richiedono percorsi relativi al workspace, bloccano i symlink e rifiutano directory sensibili o generate comuni; ciò non crea una sandbox completa. È supportato un solo workspace locale; workspace remoti e multi-root non sono supportati.

## Sviluppo

Requisiti e istruzioni per avvio e pacchettizzazione sono nel README principale. Comandi utili:

```bash
npm install
npm run compile
npm run check
```

Per provare l’estensione, aprire il progetto in VS Code, premere **F5** e aprire un workspace di prova nella finestra Extension Development Host. Per creare il VSIX:

```bash
npm run package
```
