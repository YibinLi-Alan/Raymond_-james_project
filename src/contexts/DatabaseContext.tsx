import { createContext, useContext, ReactNode } from 'react';
import type { Trade } from '../types/trade';

/** Source of trade data: SQLite-backed API or in-memory mock. */
export interface ITradeSource {
  getAllTradesJoined(): Trade[];
}

interface DatabaseContextType {
  db: ITradeSource;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

interface DatabaseProviderProps {
  db: ITradeSource;
  children: ReactNode;
}

export function DatabaseProvider({ db, children }: DatabaseProviderProps) {
  return (
    <DatabaseContext.Provider value={{ db }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): ITradeSource {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context.db;
}
