# Mapas proprios para o modo offline

O aplicativo baixa as ruas a partir de um servidor de mapas controlado por voce. O pacote fica salvo no aparelho para caminhadas sem internet; o GPS e o trajeto continuam funcionando mesmo sem ruas. Nao e preciso contratar um servico de mapas, mas e preciso ter um computador/servidor com espaco para preparar os dados.

## Preparar uma regiao

Instale e inicie o Docker. Escolha um [extrato Geofabrik](https://download.geofabrik.de/) que contenha **toda** a area em que a pessoa pode estar ao iniciar a atividade, mais 90 km ao redor. Um extrato pequeno pode deixar ruas em branco perto da borda. Na pasta `maps`, execute, por exemplo:

```powershell
.\prepare-region.ps1 -Area monaco -MemoryGb 2
```

`monaco` serve somente para testar o processo. Para uso real, substitua pelo identificador da regiao no Planetiler/Geofabrik. O script cria `maps/data/region.mbtiles`. Consulte os [requisitos e argumentos do Planetiler](https://github.com/onthegomap/planetiler) antes de gerar uma regiao grande; extratos extensos podem exigir bastante RAM, disco e tempo. O script nao sobrescreve um pacote existente. O diretorio `maps/data` fica fora do Git.

## Servir e configurar o aplicativo

```powershell
docker compose up -d
```

Abra `http://localhost:8080` no computador. O TileServer GL Light fornece um estilo de visualizacao para o arquivo OpenMapTiles. Confira o identificador em `http://localhost:8080/styles.json`; o estilo padrao costuma ser `basic-preview`.

Em `mobile/.env.local`, configure a URL do estilo usando um endereco que **o celular consegue acessar**:

```dotenv
EXPO_PUBLIC_OFFLINE_MAP_STYLE_URL=http://SEU_IP_NA_REDE:8080/styles/basic-preview/style.json
```

No emulador Android, use `10.0.2.2` no lugar do IP. Em um aparelho fisico, use o IP do computador na mesma rede Wi-Fi. Reinicie o Metro e abra uma build de desenvolvimento nova com MapLibre. Na tela inicial, toque em **Baixar mapa ao redor (90 km)** antes de sair. Aguarde o status de area salva; depois desligue a internet e confira se as ruas e o trajeto aparecem.

O servidor precisa ficar acessivel durante o **download**. Os mapas ja baixados continuam no aparelho quando o servidor e desligado. Para baixar em outras localidades, gere e sirva um extrato que inclua essas localidades. Cobertura de qualquer ponto do planeta exigiria um servidor e dados globais muito maiores. Para acesso fora da rede local ou uso em producao, publique o servidor com HTTPS e configure essa URL no app.

Os dados de ruas vem do [OpenStreetMap](https://www.openstreetmap.org/copyright) e os tiles usam o esquema [OpenMapTiles](https://openmaptiles.org/). Mantenha a atribuicao exibida pelo mapa.
