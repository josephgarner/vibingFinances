import type {
  MetaFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Container,
  Title,
  Card,
  Text,
  Button,
  Group,
  Stack,
  Badge,
  Table,
  Select,
  Grid,
  Modal,
  TextInput,
  NumberInput,
  Checkbox,
  Combobox,
  useCombobox,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useParams,
} from "@remix-run/react";
// no extra types needed for fetcher.submit with FormData
import {
  getAccountsByAccountBook,
  getTransactionsByAccountAndMonth,
  getDistinctCategories,
  updateTransactionsCategory,
} from "../utils/database";
import type { DatabaseAccount, DatabaseTransaction } from "../utils/database";

export async function loader({ params }: LoaderFunctionArgs) {
  const accountBookId = params.accountBookId as string;
  const [accounts, book, categories] = await Promise.all([
    getAccountsByAccountBook(accountBookId),
    (await import("../utils/database")).getAccountBook(accountBookId),
    getDistinctCategories(accountBookId),
  ]);
  return json({ accounts, accountBookName: book?.name || "", categories });
}

export async function action({ request }: ActionFunctionArgs) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      intent?: string;
      accountId?: string;
      month?: string;
      transactionIds?: string[];
      category?: string;
      subCategory?: string;
    };
    if (body && body.intent === "bulk-update-categories") {
      const {
        transactionIds = [],
        category = "Uncategorized",
        subCategory = "",
      } = body;
      const updated = await updateTransactionsCategory(
        transactionIds,
        category,
        subCategory
      );
      return json({ ok: true, updated });
    } else {
      const { accountId = "", month = "" } = body;
      const monthDate = new Date(month);
      const list = await getTransactionsByAccountAndMonth(accountId, monthDate);
      return json({ ok: true, transactions: list });
    }
  }
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "bulk-update-categories") {
    const ids = formData.getAll("transactionIds").map(String);
    const category = (formData.get("category") || "Uncategorized").toString();
    const subCategory = (formData.get("subCategory") || "").toString();
    const updated = await updateTransactionsCategory(
      ids,
      category,
      subCategory
    );
    return json({ ok: true, updated });
  }
  if (intent === "list-transactions") {
    const accountId = (formData.get("accountId") || "").toString();
    const month = (formData.get("month") || "").toString();
    const monthDate = new Date(month);
    const list = await getTransactionsByAccountAndMonth(accountId, monthDate);
    return json({ ok: true, transactions: list });
  }
  if (intent === "create-transaction") {
    const accountId = (formData.get("accountId") || "").toString();
    const accountBookId = (formData.get("accountBookId") || "").toString();
    const date = (formData.get("transactionDate") || "").toString();
    const description = (formData.get("description") || "").toString();
    const category = (formData.get("category") || "").toString();
    const subCategory = (formData.get("subCategory") || "").toString();
    const debitAmount = Number(formData.get("debitAmount") || 0);
    const creditAmount = Number(formData.get("creditAmount") || 0);
    const { db } = await import("../db");
    const { transactions } = await import("../db/schema");
    const { updateAccountTotals } = await import("../utils/database");
    await db.insert(transactions).values({
      transactionDate: new Date(date),
      description,
      category,
      subCategory,
      debitAmount: debitAmount.toString(),
      creditAmount: creditAmount.toString(),
      accountId,
      accountBookId,
    });
    await updateAccountTotals(accountId);
    return json({ ok: true });
  }
  return json({ ok: false, error: "Invalid request" }, { status: 400 });
}

export const meta: MetaFunction = () => {
  return [
    { title: "Transactions - Personal Finances" },
    { name: "description", content: "View and manage transactions" },
  ];
};

export default function Transactions() {
  const { accountBookId } = useParams();
  const navigate = useNavigate();
  const loaderData = useLoaderData<typeof loader>();
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [accounts] = useState<DatabaseAccount[]>(loaderData.accounts);
  const [categories] = useState<string[]>(loaderData.categories as string[]);
  const [transactions, setTransactions] = useState<DatabaseTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetcher = useFetcher<typeof action>();
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "pf_active_book_name",
        loaderData.accountBookName || ""
      );
    }
  }, [loaderData.accountBookName]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTx, setNewTx] = useState({
    description: "",
    category: "",
    subCategory: "",
    debitAmount: 0,
    creditAmount: 0,
    transactionDate: new Date().toISOString().slice(0, 10),
  });
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkSubCategory, setBulkSubCategory] = useState("");
  const lastQueryKeyRef = useRef<string>("");
  const categoryList = useMemo(
    () =>
      Array.from(new Set([...(categories || []), "Uncategorized"])) as string[],
    [categories]
  );
  const subCategoryList = useMemo(
    () =>
      Array.from(
        new Set(transactions.map((t) => t.subCategory).filter((s) => !!s))
      ) as string[],
    [transactions]
  );

  function CreatableSelect({
    label,
    placeholder,
    data,
    value,
    onChange,
  }: {
    label: string;
    placeholder: string;
    data: string[];
    value: string;
    onChange: (val: string) => void;
  }) {
    const combobox = useCombobox({
      onDropdownClose: () => combobox.resetSelectedOption(),
    });
    const [search, setSearch] = useState<string>(value || "");
    useEffect(() => {
      setSearch(value || "");
    }, [value]);
    const normalized = useMemo(
      () =>
        Array.from(
          new Set((data || []).map((d) => String(d).trim()).filter(Boolean))
        ),
      [data]
    );
    const lower = search.trim().toLowerCase();
    const filtered = normalized.filter((item) =>
      item.toLowerCase().includes(lower)
    );
    const hasExact = normalized.some((item) => item.toLowerCase() === lower);

    return (
      <Combobox
        store={combobox}
        onOptionSubmit={(val) => {
          if (val.startsWith("__create__:")) {
            const created = val.replace("__create__:", "");
            onChange(created);
            setSearch(created);
            combobox.closeDropdown();
            return;
          }
          onChange(val);
          setSearch(val);
          combobox.closeDropdown();
        }}
      >
        <Combobox.Target>
          <TextInput
            label={label}
            placeholder={placeholder}
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              combobox.openDropdown();
              combobox.updateSelectedOptionIndex();
            }}
            onFocus={() => combobox.openDropdown()}
            onBlur={() => combobox.closeDropdown()}
          />
        </Combobox.Target>
        <Combobox.Dropdown>
          <Combobox.Options>
            {filtered.length > 0 ? (
              filtered.map((item) => (
                <Combobox.Option value={item} key={item}>
                  {item}
                </Combobox.Option>
              ))
            ) : (
              <Combobox.Empty>Nothing found</Combobox.Empty>
            )}
            {!hasExact && lower.length > 0 && (
              <Combobox.Option value={`__create__:${search}`}>
                {`+ Create "${search}"`}
              </Combobox.Option>
            )}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>
    );
  }

  // Request transactions when inputs change, but avoid duplicate submits
  useEffect(() => {
    if (!selectedAccount || !selectedMonth) {
      setTransactions([]);
      return;
    }
    const monthKey = `${selectedMonth.getFullYear()}-${String(
      selectedMonth.getMonth() + 1
    ).padStart(2, "0")}`;
    const queryKey = `${selectedAccount}_${monthKey}`;
    if (lastQueryKeyRef.current === queryKey && fetcher.state !== "idle") {
      return;
    }
    if (lastQueryKeyRef.current !== queryKey) {
      lastQueryKeyRef.current = queryKey;
      setIsLoading(true);
      const fd = new FormData();
      fd.set("intent", "list-transactions");
      fd.set("accountId", selectedAccount);
      // Send first day of month to avoid timezone drift
      fd.set("month", `${monthKey}-01T00:00:00.000Z`);
      fetcher.submit(fd, { method: "post" });
    }
  }, [selectedAccount, selectedMonth, fetcher]);

  // Persist selected account & month per account book
  useEffect(() => {
    if (!accountBookId) return;
    const acctKey = `pf_tx_account_${accountBookId}`;
    const monthKey = `pf_tx_month_${accountBookId}`;
    // Load persisted values on mount or accountBook change
    if (typeof window !== "undefined") {
      const persistedAccount = window.localStorage.getItem(acctKey) || "";
      const persistedMonth = window.localStorage.getItem(monthKey) || "";
      if (persistedAccount) setSelectedAccount(persistedAccount);
      if (persistedMonth) {
        const d = new Date(`${persistedMonth}-01T00:00:00.000Z`);
        if (!isNaN(d.getTime())) setSelectedMonth(d);
      }
      // Fallback to current month if none persisted
      if (!persistedMonth) {
        const now = new Date();
        setSelectedMonth(new Date(now.getFullYear(), now.getMonth(), 1));
      }
    }
    // reset the query key when book changes
    lastQueryKeyRef.current = "";
  }, [accountBookId]);

  useEffect(() => {
    if (!accountBookId) return;
    if (typeof window === "undefined") return;
    const acctKey = `pf_tx_account_${accountBookId}`;
    const monthKey = `pf_tx_month_${accountBookId}`;
    if (selectedAccount) window.localStorage.setItem(acctKey, selectedAccount);
    if (selectedMonth) {
      const y = selectedMonth.getFullYear();
      const m = String(selectedMonth.getMonth() + 1).padStart(2, "0");
      window.localStorage.setItem(monthKey, `${y}-${m}`);
    }
  }, [accountBookId, selectedAccount, selectedMonth]);

  useEffect(() => {
    const data = fetcher.data as unknown as
      | { ok?: boolean; transactions?: DatabaseTransaction[] }
      | undefined;
    if (fetcher.state === "idle" && data && data.ok && data.transactions) {
      setTransactions(data.transactions);
      setIsLoading(false);
    }
  }, [fetcher.state, fetcher.data]);

  // After bulk update completes, refresh the list to reflect new categories
  useEffect(() => {
    const data = fetcher.data as unknown as
      | { ok?: boolean; updated?: number }
      | undefined;
    if (
      fetcher.state === "idle" &&
      data &&
      data.ok &&
      typeof data.updated === "number"
    ) {
      if (selectedAccount && selectedMonth) {
        const monthKey = `${selectedMonth.getFullYear()}-${String(
          selectedMonth.getMonth() + 1
        ).padStart(2, "0")}`;
        const fd = new FormData();
        fd.set("intent", "list-transactions");
        fd.set("accountId", selectedAccount);
        fd.set("month", `${monthKey}-01T00:00:00.000Z`);
        fetcher.submit(fd, { method: "post" });
      }
    }
  }, [fetcher.state, fetcher.data, selectedAccount, selectedMonth, fetcher]);

  const handleBackToDashboard = () => {
    navigate(`/dashboard/${accountBookId}`);
  };

  const handleCreateTransaction = async () => {
    if (!selectedAccount || !accountBookId) return;
    const fd = new FormData();
    fd.set("intent", "create-transaction");
    fd.set("accountId", selectedAccount);
    fd.set("accountBookId", accountBookId);
    fd.set("transactionDate", newTx.transactionDate);
    fd.set("description", newTx.description);
    fd.set("category", newTx.category);
    fd.set("subCategory", newTx.subCategory);
    fd.set("debitAmount", String(newTx.debitAmount));
    fd.set("creditAmount", String(newTx.creditAmount));
    await fetcher.submit(fd, { method: "post" });
    setIsCreateOpen(false);
    // Refresh the list after creation
    if (selectedAccount && selectedMonth) {
      const fd2 = new FormData();
      fd2.set("intent", "list-transactions");
      fd2.set("accountId", selectedAccount);
      fd2.set("month", selectedMonth.toISOString());
      fetcher.submit(fd2, { method: "post" });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Title order={1}>Transactions</Title>
          <Group>
            <Button onClick={() => setIsCreateOpen(true)}>
              Add Manual Transaction
            </Button>
            <Button onClick={handleBackToDashboard}>Back to Dashboard</Button>
          </Group>
        </Group>

        <Card shadow="sm" padding="lg" radius="md">
          <Stack gap="md">
            <Title order={2}>Filter Transactions</Title>
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Select
                  label="Select Account"
                  placeholder="Choose an account"
                  data={accounts.map((account) => ({
                    value: account.id,
                    label: account.name,
                  }))}
                  value={selectedAccount}
                  onChange={(value) =>
                    setSelectedAccount(value ?? selectedAccount)
                  }
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <DatePickerInput
                  label="Select Month"
                  placeholder="Pick a month"
                  value={selectedMonth}
                  onChange={(d) => {
                    const val = Array.isArray(d)
                      ? (d[0] as Date | null)
                      : (d as Date | null);
                    if (val instanceof Date) {
                      const first = new Date(
                        val.getFullYear(),
                        val.getMonth(),
                        1
                      );
                      setSelectedMonth(first);
                    } else {
                      setSelectedMonth(null);
                    }
                  }}
                  required
                />
              </Grid.Col>
            </Grid>
          </Stack>
        </Card>

        {selectedAccount && selectedMonth ? (
          <Card shadow="sm" padding="lg" radius="md">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Title order={2}>
                  Transactions for{" "}
                  {selectedMonth?.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </Title>
                <Group>
                  <Badge variant="light">
                    {isLoading
                      ? "Loading..."
                      : `${transactions.length} transactions`}
                  </Badge>
                  <Button
                    disabled={
                      Object.keys(selectedRows).filter((k) => selectedRows[k])
                        .length === 0
                    }
                    onClick={() => {
                      const selectedIds = Object.keys(selectedRows).filter(
                        (k) => selectedRows[k]
                      );
                      const sample = transactions.find((t) =>
                        selectedIds.includes(t.id)
                      );
                      setBulkCategory(sample?.category || "");
                      setBulkSubCategory(sample?.subCategory || "");
                      setBulkEditOpen(true);
                    }}
                  >
                    Edit Categories
                  </Button>
                </Group>
              </Group>

              {isLoading ? (
                <Text c="dimmed" ta="center" py="xl">
                  Loading transactions...
                </Text>
              ) : transactions.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  No transactions found for the selected account and month.
                </Text>
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>
                        <Checkbox
                          checked={
                            transactions.length > 0 &&
                            transactions.every((t) => selectedRows[t.id])
                          }
                          indeterminate={
                            transactions.some((t) => selectedRows[t.id]) &&
                            !transactions.every((t) => selectedRows[t.id])
                          }
                          onChange={(e) => {
                            const checked = e.currentTarget.checked;
                            const next: Record<string, boolean> = {};
                            for (const t of transactions) next[t.id] = checked;
                            setSelectedRows(next);
                          }}
                          aria-label="Select all"
                        />
                      </Table.Th>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Description</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Sub Category</Table.Th>
                      <Table.Th>Debit</Table.Th>
                      <Table.Th>Credit</Table.Th>
                      <Table.Th>Linked Transaction</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {transactions.map((transaction) => (
                      <Table.Tr key={transaction.id}>
                        <Table.Td>
                          <Checkbox
                            checked={!!selectedRows[transaction.id]}
                            onChange={(e) =>
                              setSelectedRows((prev) => ({
                                ...prev,
                                [transaction.id]: e.currentTarget.checked,
                              }))
                            }
                            aria-label={`Select ${transaction.description}`}
                          />
                        </Table.Td>
                        <Table.Td>
                          {formatDate(transaction.transactionDate)}
                        </Table.Td>
                        <Table.Td>{transaction.description}</Table.Td>
                        <Table.Td>
                          <Badge
                            color={
                              transaction.category === "Uncategorized"
                                ? "grey"
                                : "category"
                            }
                          >
                            {transaction.category}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={
                              transaction.subCategory === ""
                                ? "grey"
                                : "subCategory"
                            }
                          >
                            {transaction.subCategory}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {transaction.debitAmount > 0 ? (
                            <Text c="debit" fw={500}>
                              {formatCurrency(transaction.debitAmount)}
                            </Text>
                          ) : (
                            <Text c="dimmed">-</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {transaction.creditAmount > 0 ? (
                            <Text c="credit" fw={500}>
                              {formatCurrency(transaction.creditAmount)}
                            </Text>
                          ) : (
                            <Text c="dimmed">-</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {transaction.linkedTransactionId ? (
                            <Badge color="orange">Linked</Badge>
                          ) : (
                            <Text c="dimmed">-</Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Stack>
          </Card>
        ) : (
          <Card shadow="sm" padding="lg" radius="md">
            <Text c="dimmed" ta="center" py="xl">
              Please select an account and month to view transactions.
            </Text>
          </Card>
        )}
      </Stack>

      <Modal
        opened={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        title="Edit Categories"
        centered
      >
        <Stack gap="md">
          <CreatableSelect
            label="Category"
            placeholder="Choose or create a category"
            data={categoryList}
            value={bulkCategory}
            onChange={(v) => setBulkCategory(v)}
          />
          <CreatableSelect
            label="Sub Category"
            placeholder="Choose or create a sub category"
            data={subCategoryList}
            value={bulkSubCategory}
            onChange={(v) => setBulkSubCategory(v)}
          />
          <Group justify="flex-end">
            <Button onClick={() => setBulkEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const ids = Object.keys(selectedRows).filter(
                  (k) => selectedRows[k]
                );
                if (ids.length === 0) {
                  setBulkEditOpen(false);
                  return;
                }
                const fd = new FormData();
                fd.set("intent", "bulk-update-categories");
                fd.set("category", bulkCategory || "Uncategorized");
                fd.set("subCategory", bulkSubCategory || "");
                ids.forEach((id) => fd.append("transactionIds", id));
                fetcher.submit(fd, { method: "post" });
                setBulkEditOpen(false);
              }}
            >
              Apply
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Transaction"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Description"
            value={newTx.description}
            onChange={(e) =>
              setNewTx({ ...newTx, description: e.currentTarget.value })
            }
          />
          <Group grow>
            <TextInput
              label="Category"
              value={newTx.category}
              onChange={(e) =>
                setNewTx({ ...newTx, category: e.currentTarget.value })
              }
            />
            <TextInput
              label="Sub Category"
              value={newTx.subCategory}
              onChange={(e) =>
                setNewTx({ ...newTx, subCategory: e.currentTarget.value })
              }
            />
          </Group>
          <Group grow>
            <NumberInput
              label="Debit"
              decimalScale={2}
              value={newTx.debitAmount}
              onChange={(v) =>
                setNewTx({ ...newTx, debitAmount: Number(v || 0) })
              }
            />
            <NumberInput
              label="Credit"
              decimalScale={2}
              value={newTx.creditAmount}
              onChange={(v) =>
                setNewTx({ ...newTx, creditAmount: Number(v || 0) })
              }
            />
          </Group>
          <TextInput
            label="Date (YYYY-MM-DD)"
            value={newTx.transactionDate}
            onChange={(e) =>
              setNewTx({ ...newTx, transactionDate: e.currentTarget.value })
            }
          />
          <Group justify="flex-end">
            <Button onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTransaction}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
