# Contrato da API de sincronização

O app só envia atividades finalizadas. Configure a URL base em `mobile/.env.local`:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://api.exemplo.com/v1
```

Copie `mobile/.env.example` para começar. A URL é incorporada ao bundle pelo Expo; recarregue o app após alterá-la. Ela é pública e não deve conter senha ou token. Sem essa variável, os treinos continuam na fila local e nenhuma requisição é feita.

Para testar em um aparelho físico com uma API rodando no computador, use um endereço de rede alcançável pelo aparelho. `localhost` no iPhone ou Android aponta para o próprio aparelho.

## Requisição

`POST {EXPO_PUBLIC_API_BASE_URL}/activities`

Cabeçalho `Idempotency-Key: <activity.id>`. Corpo `multipart/form-data`, montado automaticamente pelo app:

| Campo | Tipo | Conteúdo |
| --- | --- | --- |
| `activity` | Texto JSON | Dados da atividade e todos os pontos de GPS brutos |
| `startPhoto` | Arquivo, opcional | Foto inicial, quando salva localmente |
| `finishPhoto` | Arquivo, opcional | Foto final, quando salva localmente |

Exemplo do campo `activity` (horários em milissegundos Unix, distância em metros):

```json
{
  "id": "9c926ffc-1e58-4646-9cd5-cc1c9705738f",
  "startedAt": 1780833600000,
  "finishedAt": 1780833900000,
  "durationSeconds": 300,
  "distanceMeters": 423.6,
  "startPhotoTakenAt": 1780833600000,
  "finishPhotoTakenAt": 1780833900000,
  "points": [
    {
      "id": "point-1",
      "activityId": "9c926ffc-1e58-4646-9cd5-cc1c9705738f",
      "latitude": -23.5505,
      "longitude": -46.6333,
      "altitude": null,
      "accuracy": 5,
      "speed": 1.4,
      "timestamp": 1780833603000,
      "isValid": true
    }
  ]
}
```

`isValid` pode ser `true`, `false` ou `null`. Os pontos inválidos também são enviados para permitir reprocessamento futuro. As URIs locais das fotos não fazem parte do JSON, pois só funcionam no aparelho.

## Resposta e idempotência

Após persistir atividade, pontos e fotos, a API deve responder com HTTP 2xx e JSON:

```json
{"activityId":"9c926ffc-1e58-4646-9cd5-cc1c9705738f"}
```

O app só marca atividade e item da fila como `synced` se `activityId` corresponder ao enviado. Uma falha HTTP, de rede, de leitura de foto ou uma resposta sem confirmação mantém os dados locais em `pending_sync`. O backend deve usar o ID da atividade ou o cabeçalho `Idempotency-Key` para aceitar a mesma requisição repetida sem criar duplicatas: a conexão pode cair após o servidor salvar os dados e antes de o app receber a resposta.

O app tenta sincronizar quando volta à tela inicial após finalizar, ao abrir ou retornar ao primeiro plano e quando a conectividade volta enquanto está aberto. Ele não envia durante uma atividade em andamento. As tentativas exigem o app em execução; ainda não há tarefa de sincronização com o app encerrado. Para produção, configure uma URL HTTPS e defina autenticação no backend antes de receber dados de usuários reais.
