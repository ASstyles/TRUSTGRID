export declare class DatabaseService {
    private static instance;
    private db;
    private constructor();
    static getInstance(dbPath?: string): DatabaseService;
    static getTestInstance(): DatabaseService;
    private initSchema;
    exec(sql: string): void;
    run(sql: string, params?: any[]): void;
    getOne<T = any>(sql: string, params?: any[]): T | null;
    query<T = any>(sql: string, params?: any[]): T[];
    close(): void;
}
