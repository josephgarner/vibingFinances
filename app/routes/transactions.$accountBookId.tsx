import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useState, useEffect } from "react";
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
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useFetcher, useLoaderData, useNavigate, useParams } from "@remix-run/react";
import { 
  getAccountsByAccountBook, 
  getTransactionsByAccountAndMonth,
} from "../utils/database";
import type { DatabaseAccount, DatabaseTransaction } from "../utils/database";

export async function loader({ params }: LoaderFunctionArgs) {
  const accountBookId = params.accountBookId as string;
  const [accounts, book] = await Promise.all([
    getAccountsByAccountBook(accountBookId),
    (await import('../utils/database')).getAccountBook(accountBookId),
  ]);
  return json({ accounts, accountBookName: book?.name || '' });
}

export async function action({ request }: ActionFunctionArgs) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const { accountId, month } = await request.json() as { accountId: string; month: string };
    const monthDate = new Date(month);
    const list = await getTransactionsByAccountAndMonth(accountId, monthDate);
    return json({ ok: true, transactions: list });
  }
  const formData = await request.formData();
  const intent = formData.get('intent');
  if (intent === 'create-transaction') {
    const accountId = (formData.get('accountId') || '').toString();
    const accountBookId = (formData.get('accountBookId') || '').toString();
    const date = (formData.get('transactionDate') || '').toString();
    const description = (formData.get('description') || '').toString();
    const category = (formData.get('category') || '').toString();
    const subCategory = (formData.get('subCategory') || '').toString();
    const debitAmount = Number(formData.get('debitAmount') || 0);
    const creditAmount = Number(formData.get('creditAmount') || 0);
    const { db } = await import('../db');
    const { transactions } = await import('../db/schema');
    const { updateAccountTotals } = await import('../utils/database');
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
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(new Date());
  const [accounts, setAccounts] = useState<DatabaseAccount[]>(loaderData.accounts);
  const [transactions, setTransactions] = useState<DatabaseTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetcher = useFetcher<typeof action>();
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('pf_active_book_name', (loaderData as any).accountBookName || '');
    }
  }, [loaderData]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTx, setNewTx] = useState({
    description: '',
    category: '',
    subCategory: '',
    debitAmount: 0,
    creditAmount: 0,
    transactionDate: new Date().toISOString().slice(0,10),
  });

  // Request transactions when inputs change
  useEffect(() => {
    if (!selectedAccount || !selectedMonth) {
      setTransactions([]);
      return;
    }
    setIsLoading(true);
    fetcher.submit(
      { accountId: selectedAccount, month: selectedMonth.toISOString() } as any,
      { method: 'post', encType: 'application/json' }
    );
  }, [selectedAccount, selectedMonth?.toISOString()]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && (fetcher.data as any).ok && 'transactions' in (fetcher.data as any)) {
      setTransactions(((fetcher.data as any).transactions || []) as DatabaseTransaction[]);
      setIsLoading(false);
    }
  }, [fetcher.state, fetcher.data]);

  const handleBackToDashboard = () => {
    navigate(`/dashboard/${accountBookId}`);
  };

  const handleCreateTransaction = async () => {
    if (!selectedAccount || !accountBookId) return;
    const fd = new FormData();
    fd.set('intent', 'create-transaction');
    fd.set('accountId', selectedAccount);
    fd.set('accountBookId', accountBookId);
    fd.set('transactionDate', newTx.transactionDate);
    fd.set('description', newTx.description);
    fd.set('category', newTx.category);
    fd.set('subCategory', newTx.subCategory);
    fd.set('debitAmount', String(newTx.debitAmount));
    fd.set('creditAmount', String(newTx.creditAmount));
    await fetcher.submit(fd, { method: 'post' });
    setIsCreateOpen(false);
    // Refresh the list after creation
    if (selectedAccount && selectedMonth) {
      fetcher.submit(
        { accountId: selectedAccount, month: selectedMonth.toISOString() } as any,
        { method: 'post', encType: 'application/json' }
      );
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
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
            <Button variant="light" onClick={() => setIsCreateOpen(true)}>Add Manual Transaction</Button>
            <Button 
              onClick={handleBackToDashboard}
              variant="light"
            >
              Back to Dashboard
            </Button>
          </Group>
        </Group>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={2}>Filter Transactions</Title>
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Select
                  label="Select Account"
                  placeholder="Choose an account"
                  data={accounts.map(account => ({ value: account.id, label: account.name }))}
                  value={selectedAccount}
                  onChange={(value) => setSelectedAccount(value ?? selectedAccount)}
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <DatePickerInput
                  label="Select Month"
                  placeholder="Pick a month"
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                  type="default"
                  required
                />
              </Grid.Col>
            </Grid>
          </Stack>
        </Card>

        {selectedAccount && selectedMonth ? (
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Title order={2}>
                  Transactions for {selectedMonth?.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Title>
                <Badge variant="light" color="blue">
                  {isLoading ? 'Loading...' : `${transactions.length} transactions`}
                </Badge>
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
                        <Table.Td>{formatDate(transaction.transactionDate)}</Table.Td>
                        <Table.Td>{transaction.description}</Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="gray">
                            {transaction.category}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="blue">
                            {transaction.subCategory}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {transaction.debitAmount > 0 ? (
                            <Text c="red" fw={500}>
                              {formatCurrency(transaction.debitAmount)}
                            </Text>
                          ) : (
                            <Text c="dimmed">-</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {transaction.creditAmount > 0 ? (
                            <Text c="green" fw={500}>
                              {formatCurrency(transaction.creditAmount)}
                            </Text>
                          ) : (
                            <Text c="dimmed">-</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {transaction.linkedTransactionId ? (
                            <Badge variant="light" color="orange">
                              Linked
                            </Badge>
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
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text c="dimmed" ta="center" py="xl">
              Please select an account and month to view transactions.
            </Text>
          </Card>
        )}
      </Stack>

      <Modal opened={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add Transaction" centered>
        <Stack gap="md">
          <TextInput label="Description" value={newTx.description} onChange={(e) => setNewTx({ ...newTx, description: e.currentTarget.value })} />
          <Group grow>
            <TextInput label="Category" value={newTx.category} onChange={(e) => setNewTx({ ...newTx, category: e.currentTarget.value })} />
            <TextInput label="Sub Category" value={newTx.subCategory} onChange={(e) => setNewTx({ ...newTx, subCategory: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <NumberInput label="Debit" decimalScale={2} value={newTx.debitAmount} onChange={(v) => setNewTx({ ...newTx, debitAmount: Number(v || 0) })} />
            <NumberInput label="Credit" decimalScale={2} value={newTx.creditAmount} onChange={(v) => setNewTx({ ...newTx, creditAmount: Number(v || 0) })} />
          </Group>
          <TextInput label="Date (YYYY-MM-DD)" value={newTx.transactionDate} onChange={(e) => setNewTx({ ...newTx, transactionDate: e.currentTarget.value })} />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTransaction}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
} 