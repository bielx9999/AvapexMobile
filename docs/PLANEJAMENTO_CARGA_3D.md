# Planejamento de Carga 3D

Modulo do painel administrativo em **Operacao > Planejamento de Carga 3D**. Os modelos de carroceria ficam em `loadVehicles`, as cargas em `loadCargos` e os planos em `loadPlans`. Os modelos sao independentes dos veiculos operacionais cadastrados na frota. Registros antigos com `fleetVehicleId`, placa ou frota continuam legiveis, mas esses campos nao fazem parte do cadastro atual.

## Coordenadas e unidades

- Medidas em metros, massas e reacoes em quilogramas-equivalentes.
- X: comprimento desde a dianteira da area util ate a traseira.
- Y: largura desde a lateral esquerda ate a direita.
- Z: altura desde o piso ate o teto.
- A posicao salva de um item e seu canto inferior esquerdo dianteiro. Rotacao de 90 graus troca comprimento e largura no piso.
- Os apoios e o pino-rei usam a mesma coordenada X do respectivo componente.

## Hipoteses e limites

- Na falta de centro de gravidade especifico, cada carga uniforme e a tara do componente sao concentradas em seu centro geometrico. Se dois pesos vazios cadastrados somarem a tara (tolerancia de 1%), eles prevalecem na estimativa.
- O peso bruto de conjunto articulado soma tara do cavalo, tara do implemento e carga uma unica vez. A reacao do pino-rei e transferida para a quinta roda do cavalo.
- O equilibrio estatico calcula dois apoios por componente; para configuracoes com mais apoios ou sem geometria suficiente a estimativa fica indisponivel. Nao ha rateio automatico por eixo.
- A colisao de cilindros usa sua caixa envolvente. Contato entre superficies nao e colisao. Flutuacao e empilhamento usam uma tolerancia de 1 mm. O volume ocupado nao assegura que os itens caibam fisicamente.
- Os limites sao apenas os valores cadastrados pelo usuario, sem inferencia de limite legal. Os resultados requerem confirmacao por pesagem real e nao homologam o carregamento.
- Na visualizacao do Truck, o arquivo `MercedesActros2017.fbx` e alinhado ao inicio da area util. A largura cadastrada define a escala uniforme do caminhao, enquanto comprimento e altura uteis definem exclusivamente a carroceria parametrica e o volume de carga. Carreta e Vanderleia continuam com geometria simplificada ate receberem modelos proprios. O FBX fornecido nao inclui texturas ou cores separadas e tem cerca de 19 MB; dispositivos modestos podem levar mais tempo para carregar.
- Itens nao posicionados permanecem no plano, mas nao entram no peso e volume *carregados*. O plano so pode ser salvo sem alertas de posicionamento e de limite cadastrado.

## Persistencia e acesso

Cada plano salva snapshots do veiculo, do cavalo e de cada carga, alem das referencias aos cadastros, autor, datas, versao do modelo e revisao. A revisao e conferida em transacao antes de gravar para evitar sobrescrita silenciosa. Arrastar itens so muda o estado local; a gravacao ocorre ao salvar.

As regras em `firestore.rules` restringem as tres colecoes ao perfil `admin`, seguindo a autorizacao atual do painel. **Ainda nao foram publicadas**. E necessario valida-las no Firebase Emulator e publica-las mediante autorizacao antes de usar a persistencia no projeto remoto.

O projeto atual nao possui identidade de empresa/tenant nos usuarios nem nos dados operacionais. Portanto, ainda nao e possivel impor isolamento entre empresas com seguranca nas regras. A implantacao multiempresa exige primeiro introduzir `companyId` confiavel nos perfis e documentos e migrar os dados existentes; a interface deste modulo nao deve ser considerada multiempresa ate essa etapa.
