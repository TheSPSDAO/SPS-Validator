import GlobalDb from './jest.global-db';

export default async function () {
    await GlobalDb.destroy();
}
