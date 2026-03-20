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
- Local:    http://localhost:3000
- Network:  http://192.168.x.x:3000
```

A linha **Network** é o endereço para abrir no **celular** (mesma Wi‑Fi).

## Passo 3: Abrir no navegador

1. Abra o **Chrome**, **Edge** ou **Firefox**.
2. Na barra de endereço digite **um** destes (são o mesmo app):
   ```
   http://127.0.0.1:3000
   ```
   ou
   ```
   http://localhost:3000
   ```
3. Aperte **Enter**.

**Importante:** use **http** (não https) e a porta **3000**. Se `localhost` não abrir no PC, use **`http://127.0.0.1:3000`**.

---

## Celular (mesma internet Wi‑Fi que o PC)

No celular **não funciona** `localhost` nem `127.0.0.1` — isso é só o próprio aparelho.

1. No PC, deixe `npm run dev` rodando (terminal aberto).
2. No terminal deve aparecer **Network:** `http://192.168.x.x:3000` — use **esse** IP no celular.
3. Se não aparecer, no PC abra o PowerShell e rode `ipconfig` → anote o **IPv4** da rede Wi‑Fi (ex.: `192.168.1.211`).
4. No celular, no Chrome/Safari, digite: **`http://SEU-IPv4:3000`** (ex.: `http://192.168.1.211:3000`).
5. **PC e celular** precisam estar na **mesma rede Wi‑Fi** (não use dados móveis no celular).
6. Se o Windows perguntar se o **Node.js** pode acessar a rede, escolha **Permitir** (Firewall).

Cadastro e login no celular usam o **mesmo** app; se o banco (Supabase) estiver certo no `.env.local`, o fluxo é igual ao do PC.

### Na internet (fora de casa)

Para usar de qualquer lugar sem esse IP, publique na **Vercel** e abra o link do deploy no celular.

---

## Se não abrir

- **"Este site não pode ser acessado"**  
  O servidor não está rodando. Volte ao **Passo 2** e rode `npm run dev` de novo. Deixe o terminal aberto.

- **Página em branco**  
  Espere alguns segundos (primeira carga pode demorar) e atualize (F5). Se continuar em branco, veja se aparece algum erro no terminal onde está rodando `npm run dev`.

- **Erro no terminal ao rodar `npm run dev`**  
  Rode antes `npm install` na pasta do projeto e depois `npm run dev` de novo.

- **`'next' não é reconhecido`** ou erro parecido  
  Rode `npm install` de novo na pasta do projeto (o `node_modules` pode estar incompleto).

- **`localhost` não abre, mas o terminal mostra Ready**  
  Use **`http://127.0.0.1:3000`** em vez de `localhost`. Desative VPN/proxy temporariamente e teste de novo.
