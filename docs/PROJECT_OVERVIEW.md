# ChatGPT Code Agent — panoramica del progetto

## Che cos’è

ChatGPT Code Agent è un’estensione per Visual Studio Code (MVP 0.5.6) che integra una chat laterale con l’OpenAI Responses API. L’agente può esplorare il workspace, proporre modifiche, eseguire comandi approvati, leggere la diagnostica e mantenere note locali sul progetto.

È scritto in TypeScript e supporta un solo workspace locale. Non è una sandbox: i comandi approvati vengono eseguiti con i permessi del sistema operativo dell’utente.

## Funzionalità

- Vista chat nella Activity Bar, selezione di modello e reasoning effort configurabili.
- Ciclo Responses API con chiamate agli strumenti, cancellazione e reset della catena conversazionale.
- Strumenti `list_files`, `read_file`, `write_file`, `run_command`, `get_command_status`, `stop_command` e `get_diagnostics`.
- I comandi shell approvati partono in background e restituiscono un ID; l’agente può monitorare output e completamento o arrestare un comando tramite ID. Il timeout predefinito è 60 secondi; `timeoutSeconds: 0` lo disattiva per server o watcher da lasciare in esecuzione, arrestabili con `stop_command`.
- Le schede di approvazione per le modifiche mostrano contenuto precedente e proposto e offrono **Open diff editor**; il diff non si apre automaticamente. Un rifiuto impedisce l’esecuzione.
- Contatori di token API per conversazione e sessione, con stime di costo indicative.
- Chiave API conservata in VS Code SecretStorage.
- Memoria locale a tre livelli: conoscenza permanente, nota operativa temporanea e ricerca lessicale nello storico dei riepiloghi.

## Architettura

- `src/extension.ts`: punto d’ingresso; registra vista e comandi, gestisce impostazioni, chiave API, richieste di approvazione e inizializzazione della memoria.
- `src/agent.ts`: coordina le richieste Responses API, i cicli di strumenti, cancellazione, contatori e consolidamento automatico.
- `src/workspaceTools.ts`: implementa gli strumenti file, diagnostica e shell, con controlli di percorso e approvazioni.
- `src/memory.ts`: gestisce i file `.andrea/`, note operative, ricerca nei riepiloghi e consolidamento.
- `src/usage.ts`: aggrega i token e produce stime di costo.
- `media/`: risorse grafiche dell’estensione.

## Memoria e privacy

- `MEMORY.md` contiene fatti duraturi. Il consolidamento automatico propone append di nuovi fatti e non elimina o riscrive fatti esistenti; revisionare periodicamente e rimuovere manualmente le informazioni obsolete o errate.
- `TASK.md` è una nota operativa rimpiazzata all’inizio di ogni attività e aggiornata alla sua conclusione. Non è una trascrizione della chat.
- `summaries.jsonl` contiene riepiloghi e fatti candidati generati dal modello. La ricerca locale usa corrispondenze lessicali sugli ultimi record e inserisce nel contesto al massimo pochi risultati pertinenti; non carica l’intero storico. È semplice, non semantica, e può non trovare riepiloghi correlati.
- `sessions.jsonl` registra metadati di sessione ed eventi senza testo di messaggi o argomenti/output degli strumenti. I vecchi registri creati da versioni precedenti possono ancora contenere prompt e risposte: controllarli e rimuoverli prima di condividere il workspace.
- `SEED.md` è il contesto iniziale; viene creato solo se assente.

Tutti i contenuti generati dal modello possono essere inesatti e vanno verificati. `.andrea/` è esclusa da Git nel repository, ma deve comunque essere controllata prima di condividerla. I filtri per dati sensibili non sono esaustivi. La chiave API è conservata in SecretStorage; le richieste al modello sono inviate a OpenAI secondo i relativi termini API. La consolidazione comporta una chiamata API aggiuntiva ed è disattivabile tramite `chatgptAgent.autoConsolidate`.

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
