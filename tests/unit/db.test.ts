import { afterEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "@/lib/db";

type FakeHandler = (() => void) | null;

interface FakeRequest {
  result: unknown;
  error: DOMException | null;
  onsuccess: FakeHandler;
  onerror: FakeHandler;
  onupgradeneeded: FakeHandler;
  onblocked: FakeHandler;
}

interface FakeTransaction {
  error: DOMException | null;
  oncomplete: FakeHandler;
  onerror: FakeHandler;
  onabort: FakeHandler;
  objectStore: ReturnType<typeof vi.fn>;
}

function fakeRequest(): FakeRequest {
  return {
    result: undefined,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    onblocked: null,
  };
}

function fakeDatabase(operation: FakeRequest) {
  const store = {
    getAll: vi.fn(() => operation),
    put: vi.fn(() => operation),
  };
  const transaction: FakeTransaction = {
    error: null,
    oncomplete: null,
    onerror: null,
    onabort: null,
    objectStore: vi.fn(() => store),
  };
  const database = {
    close: vi.fn(),
    createObjectStore: vi.fn(),
    objectStoreNames: { contains: vi.fn(() => true) },
    onversionchange: null as FakeHandler,
    transaction: vi.fn(() => transaction),
  };
  return { database, store, transaction };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("IndexedDB durability", () => {
  it("retries opening the database after a transient failure", async () => {
    const firstOpen = fakeRequest();
    const secondOpen = fakeRequest();
    const operation = fakeRequest();
    const { database, transaction } = fakeDatabase(operation);
    const open = vi
      .fn()
      .mockReturnValueOnce(firstOpen as unknown as IDBOpenDBRequest)
      .mockReturnValueOnce(secondOpen as unknown as IDBOpenDBRequest);
    vi.stubGlobal("indexedDB", { open } as unknown as IDBFactory);

    const { listConversations } = await import("@/lib/db");
    const failed = listConversations();
    firstOpen.error = new DOMException("temporarily unavailable", "UnknownError");
    firstOpen.onerror?.();

    await expect(failed).rejects.toThrow("temporarily unavailable");

    const retried = listConversations();
    expect(open).toHaveBeenCalledTimes(2);
    secondOpen.result = database;
    secondOpen.onsuccess?.();
    await flushMicrotasks();
    operation.result = [];
    operation.onsuccess?.();
    transaction.oncomplete?.();

    await expect(retried).resolves.toEqual([]);
  });

  it("does not report a write as saved before the transaction commits", async () => {
    const opening = fakeRequest();
    const operation = fakeRequest();
    const { database, transaction } = fakeDatabase(operation);
    const open = vi.fn(() => opening as unknown as IDBOpenDBRequest);
    vi.stubGlobal("indexedDB", { open } as unknown as IDBFactory);

    const { saveConversation } = await import("@/lib/db");
    const conversation: Conversation = {
      id: "conversation-1",
      title: "Test",
      createdAt: 1,
      updatedAt: 1,
      messages: [],
    };
    let resolved = false;
    const saving = saveConversation(conversation).then(() => {
      resolved = true;
    });

    opening.result = database;
    opening.onsuccess?.();
    await flushMicrotasks();
    operation.onsuccess?.();
    await flushMicrotasks();
    expect(resolved).toBe(false);

    transaction.oncomplete?.();
    await saving;
    expect(resolved).toBe(true);
  });

  it("closes a late connection after a blocked opening was already rejected", async () => {
    const opening = fakeRequest();
    const operation = fakeRequest();
    const { database } = fakeDatabase(operation);
    const open = vi.fn(() => opening as unknown as IDBOpenDBRequest);
    vi.stubGlobal("indexedDB", { open } as unknown as IDBFactory);

    const { listConversations } = await import("@/lib/db");
    const loading = listConversations();
    opening.onblocked?.();

    await expect(loading).rejects.toThrow("IndexedDB open blocked");

    opening.result = database;
    opening.onsuccess?.();
    expect(database.close).toHaveBeenCalledOnce();
  });
});
