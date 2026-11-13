import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import oracledb from 'oracledb';

initializeApp();

const oracleConnectString = defineSecret('ORACLE_CONNECT_STRING');
const oracleUsername = defineSecret('ORACLE_USERNAME');
const oraclePassword = defineSecret('ORACLE_PASSWORD');

export const testOracleConnection = onCall({
  region: 'us-central1',
  timeoutSeconds: 30,
  memory: '256MiB',
  secrets: [oracleConnectString, oracleUsername, oraclePassword],
}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Entre no painel para testar a conexao.');

  const profile = await getFirestore().collection('users').doc(uid).get();
  if (profile.data()?.role !== 'admin' || profile.data()?.status !== 'active') {
    throw new HttpsError('permission-denied', 'Somente administradores ativos podem testar a conexao.');
  }

  const connectString = oracleConnectString.value().trim();
  const user = oracleUsername.value().trim();
  const password = oraclePassword.value();
  if (!connectString || !user || !password) {
    throw new HttpsError('failed-precondition', 'Configure os segredos de conexao Oracle no Firebase antes do teste.');
  }

  let connection;
  try {
    connection = await oracledb.getConnection({ connectString, user, password });
    const result = await connection.execute('SELECT 1 AS CONNECTION_OK FROM DUAL');
    if (result.rows?.length !== 1) throw new Error('Oracle returned no health-check row.');
    return { connected: true, checkedAt: new Date().toISOString() };
  } catch (error) {
    const oracleCode = typeof error?.code === 'string' ? error.code : undefined;
    console.error('Oracle connectivity test failed', { oracleCode });
    throw new HttpsError('unavailable', 'Nao foi possivel conectar ao Oracle. Verifique credenciais e acesso de rede.', oracleCode ? { oracleCode } : undefined);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        console.warn('Oracle connection close failed', { code: typeof error?.code === 'string' ? error.code : 'unknown' });
      }
    }
  }
});

export const listOracleVehicles = onCall({
  region: 'us-central1',
  timeoutSeconds: 60,
  memory: '512MiB',
  secrets: [oracleConnectString, oracleUsername, oraclePassword],
}, async (request) => {
  await assertActiveAdmin(request.auth?.uid);
  const connection = await openOracleConnection();
  try {
    const result = await connection.execute(
      `SELECT VEICULO, PREFIXO, PLACA, DESCRICAO, DESCRICAO_TF
       FROM (
         SELECT VEICULO, PREFIXO, PLACA, DESCRICAO, DESCRICAO_TF
         FROM VWTRR_VEICULOS
         ORDER BY PREFIXO
       )
       WHERE ROWNUM <= 5000`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return {
      vehicles: (result.rows ?? []).map((row) => ({
        vehicle: cellString(row.VEICULO),
        prefix: cellString(row.PREFIXO),
        plate: cellString(row.PLACA),
        description: cellString(row.DESCRICAO),
        typeDescription: cellString(row.DESCRICAO_TF),
      })),
      limited: (result.rows?.length ?? 0) === 5000,
    };
  } catch (error) {
    const oracleCode = typeof error?.code === 'string' ? error.code : undefined;
    console.error('Oracle vehicle query failed', { oracleCode });
    throw new HttpsError('unavailable', 'Nao foi possivel consultar VWTRR_VEICULOS. Verifique o acesso e as colunas da view.', oracleCode ? { oracleCode } : undefined);
  } finally {
    await connection.close();
  }
});

export const listOracleDrivers = onCall({
  region: 'us-central1',
  timeoutSeconds: 60,
  memory: '512MiB',
  secrets: [oracleConnectString, oracleUsername, oraclePassword],
}, async (request) => {
  await assertActiveAdmin(request.auth?.uid);
  const connection = await openOracleConnection();
  try {
    const result = await connection.execute(
      `SELECT NOME, NOMECOMPLETO, APELIDO, CODFUNCAO, CODIGO, HABILITACAO,
              VALIDADECNH, RG, CNH, CATEGORIACNH, TELEFONE, BAIRRO,
              CIDADE, ENDERECO, UF
       FROM (
         SELECT NOME, NOMECOMPLETO, APELIDO, CODFUNCAO, CODIGO, HABILITACAO,
                VALIDADECNH, RG, CNH, CATEGORIACNH, TELEFONE, BAIRRO,
                CIDADE, ENDERECO, UF
         FROM VWCGS_FUNCIONARIOSCOMAGREGADO
         ORDER BY NOMECOMPLETO, CODIGO
       )
       WHERE ROWNUM <= 5000`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return {
      drivers: (result.rows ?? []).map((row) => ({
        name: cellString(row.NOME),
        fullName: cellString(row.NOMECOMPLETO),
        nickname: cellString(row.APELIDO),
        jobCode: cellString(row.CODFUNCAO),
        code: cellString(row.CODIGO),
        license: cellString(row.HABILITACAO),
        licenseExpiration: row.VALIDADECNH instanceof Date ? row.VALIDADECNH.toISOString() : cellString(row.VALIDADECNH),
        identity: cellString(row.RG),
        licenseNumber: cellString(row.CNH),
        licenseCategory: cellString(row.CATEGORIACNH),
        phone: cellString(row.TELEFONE),
        neighborhood: cellString(row.BAIRRO),
        city: cellString(row.CIDADE),
        address: cellString(row.ENDERECO),
        state: cellString(row.UF),
      })),
      limited: (result.rows?.length ?? 0) === 5000,
    };
  } catch (error) {
    const oracleCode = typeof error?.code === 'string' ? error.code : undefined;
    console.error('Oracle driver query failed', { oracleCode });
    throw new HttpsError('unavailable', 'Nao foi possivel consultar VWCGS_FUNCIONARIOSCOMAGREGADO. Verifique o acesso e as colunas da view.', oracleCode ? { oracleCode } : undefined);
  } finally {
    await connection.close();
  }
});

async function assertActiveAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', 'Entre no painel para acessar o Oracle.');
  const profile = await getFirestore().collection('users').doc(uid).get();
  if (profile.data()?.role !== 'admin' || profile.data()?.status !== 'active') {
    throw new HttpsError('permission-denied', 'Somente administradores ativos podem consultar o Oracle.');
  }
}

async function openOracleConnection() {
  const connectString = oracleConnectString.value().trim();
  const user = oracleUsername.value().trim();
  const password = oraclePassword.value();
  if (!connectString || !user || !password) {
    throw new HttpsError('failed-precondition', 'Configure os segredos de conexao Oracle no Firebase antes da consulta.');
  }
  try {
    return await oracledb.getConnection({ connectString, user, password });
  } catch (error) {
    const oracleCode = typeof error?.code === 'string' ? error.code : undefined;
    console.error('Oracle connection failed', { oracleCode });
    throw new HttpsError('unavailable', 'Nao foi possivel conectar ao Oracle. Verifique credenciais e acesso de rede.', oracleCode ? { oracleCode } : undefined);
  }
}

function cellString(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}
