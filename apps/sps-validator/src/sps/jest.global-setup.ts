import GlobalDb from './jest.global-db';

export default async function () {
    const { templateDb, connectionString } = await GlobalDb.init();
    process.env.SPL_TEST_DB_TEMPLATE = templateDb;
    process.env.SPL_TEST_DB_TEMPLATE_CONNECTION_STRING = connectionString;
    process.env.TZ = 'UTC';
}
