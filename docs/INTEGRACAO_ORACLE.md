# Integracao Oracle

O painel web chama Firebase Callable Functions autenticadas. As Functions verificam o perfil de administrador no Firebase e guardam as credenciais no servidor. `testOracleConnection` executa `SELECT 1 FROM DUAL`. `listOracleVehicles` consulta somente `VEICULO`, `PREFIXO`, `PLACA`, `DESCRICAO` e `DESCRICAO_TF` da view `VWTRR_VEICULOS`. `listOracleDrivers` consulta os campos fornecidos de `VWCGS_FUNCIONARIOSCOMAGREGADO`. Ambas as listagens sao limitadas a 5.000 linhas e somente leitura.

## Segredos

No terminal autenticado no projeto Firebase correto, configure os tres segredos. O CLI solicita os valores sem adiciona-los ao repositorio:

```powershell
firebase functions:secrets:set ORACLE_CONNECT_STRING
firebase functions:secrets:set ORACLE_USERNAME
firebase functions:secrets:set ORACLE_PASSWORD
```

`ORACLE_CONNECT_STRING` deve ser o connect descriptor/EZConnect fornecido pelo DBA. Nao salve valores em arquivos `.env` versionados nem em variaveis `VITE_*`.

## Rede e implantacao

1. O ambiente de execucao de Cloud Functions precisa conseguir abrir conexao TCP na porta Oracle configurada.
2. O firewall/ACL/Oracle Network Security Group precisa permitir o egress do backend. Se exigir IP de origem fixo, sera necessario configurar egress por VPC Connector e Cloud NAT com IP reservado, ou executar o backend na rede corporativa/VPN autorizada.
3. Implantar `firebase deploy --only functions` e abrir Cadastros > Banco da empresa para testar e consultar as views.
4. O backend esta na regiao `us-central1`; alinhar a rota de rede e latencia com o DBA antes da implantacao.

As consultas nao escrevem dados no Oracle. A view de funcionarios pode conter outras funcoes alem de motoristas; filtrar por `CODFUNCAO` depende de confirmar os codigos de motorista com o DBA. Nao publicar nem copiar credenciais em tickets, conversas ou codigo.
