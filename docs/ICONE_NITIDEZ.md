# Ícone mais nítido (Trim Time)

## No código (já aplicado)

- O **logo na interface** (`BrandLogo`) usa **`unoptimized`**: o navegador recebe o **PNG original** de `public/icon.png`, sem conversão para WebP/AVIF (que às vezes suaviza detalhes).
- Os `sizes` pedem versões com mais pixels para telas **retina**.

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
