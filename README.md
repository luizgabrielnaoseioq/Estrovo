# Treinos Offline

Aplicativo React Native com TypeScript para registrar atividades localmente. O projeto mobile está em `mobile/` e usa SQLite para persistência local.

## Executar

```powershell
cd mobile
npm ci
npm run typecheck
npm start
```

Abra o aplicativo em uma build de desenvolvimento no Android ou iOS. Toque em **Tirar foto e iniciar**: o app solicita as permissões de localização e câmera, abre a câmera para a foto inicial e só começa a atividade depois de salvar a foto. O tempo, a precisão da localização, a quantidade de pontos salvos e a distância filtrada aparecem na tela. Se a permissão for negada, a localização do aparelho estiver desligada ou a foto for cancelada, a atividade não começa. Para encerrar, toque em **Tirar foto e finalizar**: a câmera abre para a foto final e o treino só termina quando ela é salva. Cancelar a foto mantém a atividade em andamento. Se você fechar e reabrir o app durante uma atividade, ele mostra uma tela de recuperação com a foto e a distância salvas. Nela, escolha **Continuar atividade** para retomar o acompanhamento ou **Tirar foto e finalizar** para encerrá-la diretamente.

O banco contém as tabelas `activities` e `raw_location_points`. Cada leitura recebida é salva localmente, com coordenadas, altitude, precisão, velocidade e horário originais. O filtro marca `is_valid` como 1 ou 0 sem apagar os pontos brutos. Leituras com precisão pior que 50 m, velocidade acima de 10 m/s, saltos incompatíveis com o tempo decorrido e movimentos menores que a margem de precisão não entram no total. A distância dos segmentos aceitos usa Haversine e é gravada em `activities.distance_meters` na mesma transação que classifica o ponto. Ao abrir o app, pontos de versões anteriores ainda não classificados são processados e a distância é recuperada. Os limites são heurísticos para caminhada/corrida e podem ser ajustados após testes reais.

O rastreamento em segundo plano usa `expo-location` e `expo-task-manager`. Em uma **build de desenvolvimento**, o app solicita a permissão de localização em segundo plano antes de iniciar o treino e, quando ela é concedida, registra os pontos pela tarefa nativa. No Android, um serviço em primeiro plano mantém uma notificação enquanto o treino está ativo. Ao finalizar, o serviço é encerrado. Se a permissão não for concedida ou o app estiver no Expo Go, o registro continua somente com o app aberto e a tela informa essa limitação.

Para testar o segundo plano e a câmera no Android, gere e instale uma build de desenvolvimento (`npm run android:dev` com Android SDK e JDK configurados, ou `npx eas-cli@24.8.0 build --platform android --profile development` pelo Expo). Se instalou a build do Expo, inicie o servidor com `npx expo start --dev-client --host lan` no mesmo computador e conecte o app a ele; a build de desenvolvimento precisa desse servidor. Inicie um treino, escolha **Configurar acesso** e conceda localização **o tempo todo**. Tire a foto inicial. Bloqueie a tela, simule ou faça um pequeno deslocamento, desbloqueie e confirme que os pontos e a distância aumentaram. Tire a foto final e confira as duas miniaturas no histórico. O Expo Go serve para testar o registro em primeiro plano, mas não executa a tarefa de localização em segundo plano. O comportamento após encerramento forçado pelo sistema varia conforme o aparelho; reabrir o app recupera a atividade ainda em andamento.

As fotos ficam no diretório de documentos do app e suas URIs e horários de captura ficam associados à atividade no SQLite. Uma build de desenvolvimento feita antes da inclusão de `expo-image-picker` precisa ser substituída por uma build nova para a câmera funcionar.

Fotos novas recebem uma faixa com data e hora locais gravada nos pixels antes de serem associadas ao treino. O app abre apenas a câmera para criar fotos de início e fim; não há importação da galeria. O botão **Salvar foto** cria uma cópia na galeria, mediante a permissão do aparelho, sem remover o arquivo usado pelo treino. Fotos registradas antes da marca d'água permanecem como foram capturadas. Como `expo-media-library`, `expo-image-manipulator` e Skia incluem código nativo, é preciso instalar uma nova build de desenvolvimento para testar essa etapa.

## Mapa do percurso

O minimapa usa somente pontos de GPS classificados como válidos. A linha, o início e o fim aparecem durante o treino, na recuperação e no histórico. O trajeto continua salvo no SQLite e aparece sem internet, mesmo quando não há ruas baixadas. Com internet, o app mostra as ruas do OpenFreeMap sobre o traçado.

Para deixar as ruas disponíveis offline, [gere e sirva seus próprios mapas OpenStreetMap](maps/README.md) e configure `EXPO_PUBLIC_OFFLINE_MAP_STYLE_URL` em `mobile/.env.local` com a URL do estilo. O app então oferece **Baixar mapa ao redor (90 km)** na tela inicial. O download é iniciado pelo usuário, centrado na localização atual e cobre um raio de 90 km; o nível máximo de detalhe é ajustado para respeitar o limite de 10 mil blocos. O app mostra o progresso e permite pausar ou continuar. A área baixada fica no armazenamento do aparelho. Sem fonte configurada, as ruas ficam disponíveis apenas online e o traçado sem ruas permanece disponível offline. Os servidores públicos de tiles do OpenStreetMap e do OpenFreeMap não são usados para downloads antecipados.

MapLibre inclui código nativo. Após esta etapa, gere uma nova build de desenvolvimento para Android ou iOS; o Expo Go e builds anteriores não contêm o módulo de mapas.

Para testar a recuperação, inicie uma atividade, feche o app e abra-o novamente. Confira a tela **Treino encontrado** e a foto inicial. Toque em **Continuar atividade**, feche e abra mais uma vez e então finalize pela tela de recuperação. A atividade finalizada deve aparecer no histórico com as duas fotos, sem criar outra atividade nem perder os pontos já salvos. O sistema operacional pode encerrar o rastreamento durante um fechamento forçado; ao reabrir, o app verifica e reinicia o serviço quando a permissão de localização em segundo plano está disponível.

## Fila de sincronização

Ao finalizar, o app grava a atividade com `status = pending_sync` e cria um item em `sync_queue` na mesma transação SQLite. Atividades finalizadas antes dessa etapa entram na fila durante a migração do banco. O histórico mostra **Aguardando sincronização** enquanto o item está pendente. A fila conserva a quantidade de tentativas e a data da última tentativa. Quando a API está configurada e confirma o recebimento, o app marca atividade e item como `synced` na mesma transação. Uma falha de envio mantém os dados locais e a atividade pendente para uma nova tentativa.

Para testar, finalize um treino e confira **Aguardando sincronização** no histórico. Feche e reabra o app: o estado deve continuar. No banco SQLite, a linha da atividade deve ter `pending_sync` e deve existir exatamente um item `pending` em `sync_queue` com o mesmo `activity_id`.

## Integração com API

O endereço do backend é configurável por `EXPO_PUBLIC_API_BASE_URL` em `mobile/.env.local` (veja `mobile/.env.example`). Sem um endereço, o app continua registrando offline e deixa as atividades na fila. Com o endereço configurado, ele tenta enviar as atividades pendentes ao voltar à tela inicial, ao abrir o app e quando a conexão retorna enquanto o app está aberto. Fotos e pontos brutos seguem juntos; somente a confirmação da API muda o status para `synced`. Erros preservam a fila e os dados locais. O [contrato completo da API](mobile/docs/sync-api.md) define os campos, a resposta e a regra de idempotência para implementar o backend futuramente.

O detector de conectividade usa `expo-network`. Depois de instalar essa dependência, é necessário gerar uma nova build de desenvolvimento para testar no Android ou iOS. A URL `EXPO_PUBLIC_` é pública no bundle: não coloque tokens ou senhas nela. Em produção, use HTTPS e implemente autenticação no backend.
