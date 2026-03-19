# Como abrir o Trim Time no localhost

## Passo 1: Abrir o terminal na pasta do projeto

- No Cursor/VS Code: **Terminal** → **New Terminal** (ou `` Ctrl+` ``).
- Ou abra o **Prompt de Comando** / **PowerShell** e vá até a pasta do projeto:
  ```bash
  cd "c:\Users\bsbth\Meu projeto trim time"
  ```

## Passo 2: Subir o servidor

No terminal, rode:

```bash
npm run dev
```

Espere aparecer algo como:

```
✓ Ready in 3.1s
- Local:   http://localhost:3001
```

## Passo 3: Abrir no navegador

1. Abra o **Chrome**, **Edge** ou **Firefox**.
2. Na barra de endereço digite exatamente:
   ```
   http://localhost:3001
   ```
3. Aperte **Enter**.

**Importante:** use **http** (não https) e a porta **3001** (configurada no `npm run dev`).

---

## Se não abrir

- **"Este site não pode ser acessado"**  
  O servidor não está rodando. Volte ao **Passo 2** e rode `npm run dev` de novo. Deixe o terminal aberto.

- **Página em branco**  
  Espere alguns segundos (primeira carga pode demorar) e atualize (F5). Se continuar em branco, veja se aparece algum erro no terminal onde está rodando `npm run dev`.

- **Erro no terminal ao rodar `npm run dev`**  
  Rode antes `npm install` na pasta do projeto e depois `npm run dev` de novo.
