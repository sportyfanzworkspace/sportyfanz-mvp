import { db } from "@/lib/prisma";

export type DiscoveryImportTransaction =
  Parameters<
    Parameters<typeof db.transaction>[0]
  >[0];

export async function withImportTransaction<T>(
  transaction: DiscoveryImportTransaction | undefined,
  operation: (
    tx: DiscoveryImportTransaction
  ) => Promise<T>
): Promise<T> {
  if (transaction) {
    return operation(transaction);
  }

  return db.transaction(async tx => {
    return operation(tx);
  });
}
