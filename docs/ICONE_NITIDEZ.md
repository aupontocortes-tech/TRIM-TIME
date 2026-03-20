# Ícone mais nítido (Trim Time)

## No código (já aplicado)

- O **logo na interface** (`BrandLogo`) usa **`unoptimized`**: o navegador recebe o **PNG original** de `public/icon.png`, sem conversão para WebP/AVIF (que às vezes suaviza detalhes).
- Os `sizes` pedem versões com mais pixels para telas **retina**.

## Fundo branco no ficheiro PNG (área em baixo / bordas)

Se o PNG tiver **branco opaco** (comum em exportações), o CSS não consegue “apagar”. O projeto inclui um script que **pinta esses pixels de preto** (~cor do tema), sem estragar o dourado (detecta branco/cinza neutro, baixa saturação).

```bash
npm run fix-logo
```

Por defeito processa `public/icon.png` e sobrescreve o mesmo ficheiro. Para outra imagem:

```bash
node scripts/fix-logo-white-to-bg.mjs caminho/entrada.png public/icon.png
```

Depois copie `public/icon.png` para `app/icon.png` e `app/apple-icon.png` (ou rode o mesmo comando com saída e copie).

## Fundo no layout (BrandLogo)

O **BrandLogo** usa `bg-background`. As zonas **transparentes** do PNG misturam-se com o tema escuro.

## O que mais ajuda (arquivo de imagem)

O teto da nitidez é a **resolução do arquivo**:

1. Exporte o logo em **PNG** (não JPEG).
2. Tamanho recomendado: **1024×1024 px** (mínimo **512×512**).
3. Substitua **`public/icon.png`** e copie o mesmo ficheiro para:
   - `app/icon.png`
   - `app/apple-icon.png`
4. Atualize a página com **Ctrl+F5** (limpar cache do ícone).

## Favicon / PWA

`app/icon.png` e `app/apple-icon.png` são usados pelo Next.js para aba e “Adicionar à tela inicial”. Manter os três ficheiros **iguais** evita diferença entre favicon e logo no site.
