import type {
  MetaFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { useState, useEffect } from "react";
import {
  Container,
  Title,
  Card,
  Text,
  Button,
  Modal,
  TextInput,
  Group,
  Stack,
  Grid,
  NumberInput,
  FileInput,
  Select,
  Notification,
  Menu,
  ActionIcon,
  Divider,
} from "@mantine/core";
import { IconSettings, IconPlus, IconUpload } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { parseQIFFile, type QIFTransaction } from "../utils/qifParser";
import type { DatabaseAccount } from "../utils/database";

export async function loader({ params }: LoaderFunctionArgs) {
  const accountBookId = params.accountBookId as string;
  const { getAccountsByAccountBook, getAccountBook } = await import(
    "../utils/database"
  );
  const [accounts, book] = await Promise.all([
    getAccountsByAccountBook(accountBookId),
    getAccountBook(accountBookId),
  ]);
  return json({ accounts, accountBookId, accountBookName: book?.name || "" });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const accountBookId = params.accountBookId as string;
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    if (body.intent === "save-transactions") {
      const { qifTransactions, accountId } = body as {
        qifTransactions: QIFTransaction[];
        accountId: string;
      };
      const { saveTransactions } = await import("../utils/database");
      const saved = await saveTransactions(
        qifTransactions,
        accountId,
        accountBookId
      );
      return json({ ok: true, count: saved.length });
    }
    return json({ ok: false, error: "Unknown intent" }, { status: 400 });
  }
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "create-account") {
    const name = (formData.get("name") || "").toString();
    const totalMonthlyBalance = Number(
      formData.get("totalMonthlyBalance") || 0
    );
    const totalMonthlyDebits = Number(formData.get("totalMonthlyDebits") || 0);
    const totalMonthlyCredits = Number(
      formData.get("totalMonthlyCredits") || 0
    );
    const { createAccount } = await import("../utils/database");
    const created = await createAccount(
      name,
      totalMonthlyBalance,
      totalMonthlyDebits,
      totalMonthlyCredits,
      accountBookId
    );
    return json({ ok: true, account: created });
  } else if (intent === "clear-last-month") {
    const accountId = (formData.get("accountId") || "").toString();
    const { clearAccountLastMonthData } = await import("../utils/database");
    await clearAccountLastMonthData(accountId);
    return json({ ok: true });
  } else if (intent === "clear-all") {
    const accountId = (formData.get("accountId") || "").toString();
    const { clearAccountAllData } = await import("../utils/database");
    await clearAccountAllData(accountId);
    return json({ ok: true });
  } else if (intent === "clear-month") {
    const accountId = (formData.get("accountId") || "").toString();
    const month = (formData.get("month") || "").toString();
    const { clearAccountMonthData } = await import("../utils/database");
    await clearAccountMonthData(accountId, month);
    return json({ ok: true });
  } else if (intent === "delete-account") {
    const accountId = (formData.get("accountId") || "").toString();
    const { deleteAccount } = await import("../utils/database");
    await deleteAccount(accountId);
    return json({ ok: true, deleted: true });
  }
  return json({ ok: false, error: "Unknown intent" }, { status: 400 });
}

export const meta: MetaFunction = () => {
  return [
    { title: "Dashboard - Personal Finances" },
    { name: "description", content: "Account book dashboard" },
  ];
};

export default function Dashboard() {
  const navigate = useNavigate();
  const loaderData = useLoaderData<typeof loader>();
  const accountBookId = loaderData.accountBookId as string;
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "pf_active_book_name",
        (loaderData as any).accountBookName || ""
      );
    }
  }, [loaderData]);
  const [accounts, setAccounts] = useState<DatabaseAccount[]>(
    loaderData?.accounts ?? []
  );
  const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] =
    useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedAccountForUpload, setSelectedAccountForUpload] =
    useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const fetcher = useFetcher<typeof action>();
  const [confirm, setConfirm] = useState<{
    open: boolean;
    title: string;
    description: string;
    intent: "clear-all" | "delete-account";
    accountId: string;
  } | null>(null);
  const [monthClear, setMonthClear] = useState<{
    open: boolean;
    accountId: string;
    selected?: string;
  } | null>(null);

  const accountForm = useForm({
    initialValues: {
      name: "",
      totalMonthlyBalance: 0,
      totalMonthlyDebits: 0,
      totalMonthlyCredits: 0,
    },
    validate: {
      name: (value) =>
        value.length < 2 ? "Name must be at least 2 characters" : null,
    },
  });

  useEffect(() => {
    if (loaderData && (loaderData as any).accounts) {
      setAccounts((loaderData as any).accounts as DatabaseAccount[]);
    }
  }, [loaderData]);

  const handleCreateAccount = async (values: typeof accountForm.values) => {
    if (!accountBookId) return;
    const fd = new FormData();
    fd.set("intent", "create-account");
    fd.set("name", values.name);
    fd.set("totalMonthlyBalance", String(values.totalMonthlyBalance));
    fd.set("totalMonthlyDebits", String(values.totalMonthlyDebits));
    fd.set("totalMonthlyCredits", String(values.totalMonthlyCredits));
    const res = await fetcher.submit(fd, { method: "post" });
  };

  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data &&
      (fetcher.data as any).ok &&
      (fetcher.data as any).account
    ) {
      // Loader revalidation will refresh accounts; avoid local append to prevent duplicates
      setIsCreateAccountModalOpen(false);
      accountForm.reset();
      setNotification({
        type: "success",
        message: "Account created successfully!",
      });
    }
  }, [fetcher.state, fetcher.data]);

  const handleFileUpload = async (file: File | null) => {
    setUploadedFile(file);
  };

  const handleUploadTransactions = async () => {
    if (!uploadedFile || !selectedAccountForUpload || !accountBookId) {
      setNotification({
        type: "error",
        message: "Please select a file and account before uploading.",
      });
      return;
    }

    setIsUploading(true);
    try {
      const qifTransactions = await parseQIFFile(uploadedFile);
      if (qifTransactions.length === 0) {
        setNotification({
          type: "error",
          message: "No transactions found in the QIF file.",
        });
        return;
      }

      await fetcher.submit(
        {
          intent: "save-transactions",
          qifTransactions: qifTransactions as any,
          accountId: selectedAccountForUpload,
        } as any,
        { method: "post", encType: "application/json" }
      );

      setIsUploadModalOpen(false);
      setSelectedAccountForUpload("");
      setUploadedFile(null);

      setNotification({
        type: "success",
        message: `Successfully uploaded transactions!`,
      });
    } catch (error) {
      setNotification({
        type: "error",
        message:
          "Failed to upload transactions. Please check the file format and try again.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleNavigateToTransactions = () => {
    navigate(`/transactions/${accountBookId}`);
  };

  const formatBarData = (historical: { month: string; debits: number; credits: number }[]) => {
    const sorted = [...historical].sort((a, b) => a.month.localeCompare(b.month));
    const recent = sorted.slice(-6);
    return recent.map((item) => ({
      month: item.month,
      Debits: item.debits,
      Credits: item.credits,
    }));
  };

  const [selectedForBalance, setSelectedForBalance] = useState<string>(
    accounts[0]?.id || ""
  );

  // Persist selected account for the balance chart per account book
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = `pf_balance_selected_${accountBookId}`;
    const stored = window.localStorage.getItem(storageKey);
    if (stored && accounts.some((a) => a.id === stored)) {
      setSelectedForBalance(stored);
    } else if (accounts[0]?.id) {
      // Ensure a default is stored
      window.localStorage.setItem(storageKey, accounts[0].id);
      setSelectedForBalance(accounts[0].id);
    }
  }, [accountBookId, accounts]);

  const handleChangeSelectedForBalance = (id: string | null) => {
    if (id) {
      setSelectedForBalance(id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`pf_balance_selected_${accountBookId}`, id);
      }
    }
  };

  const balanceSeries = () => {
    const account = accounts.find((a) => a.id === selectedForBalance);
    if (!account) return [] as any[];
    const sorted = [...(account.historicalBalance as any)].sort(
      (a: any, b: any) => a.month.localeCompare(b.month)
    );
    const recent = sorted.slice(-6);
    return [
      {
        id: "Balance",
        data: recent.map((m: any) => ({
          x: m.month,
          y: Number(
            typeof m.balance === "number" ? m.balance : m.credits - m.debits
          ),
        })),
      },
    ];
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {notification && (
          <div style={{ position: "fixed", top: 16, right: 16, zIndex: 1000 }}>
            <Notification
              title={notification.type === "success" ? "Success" : "Error"}
              color={notification.type === "success" ? "green" : "red"}
              onClose={() => setNotification(null)}
              withCloseButton
            >
              {notification.message}
            </Notification>
          </div>
        )}

        <Group justify="space-between" align="center">
          <Title order={1}>Account Book Dashboard</Title>
          <Group>
            <Button
              variant="filled"
              leftSection={<IconPlus size={16} />}
              onClick={() => setIsCreateAccountModalOpen(true)}
            >
              Create Account
            </Button>
            <Button
              variant="light"
              leftSection={<IconUpload size={16} />}
              onClick={() => setIsUploadModalOpen(true)}
            >
              Upload QIF
            </Button>
          </Group>
        </Group>

        {accounts.length === 0 ? (
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text c="dimmed" ta="center" py="xl">
              No accounts found. Create your first account to get started.
            </Text>
          </Card>
        ) : (
          <Grid>
            {/* Left: Monthly balance line chart (2/3) */}
            <Grid.Col span={{ base: 12, lg: 8 }}>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Title order={3}>Monthly Balance (6 months)</Title>
                    <Select
                      data={[...accounts]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((a) => ({ value: a.id, label: a.name }))}
                      value={selectedForBalance}
                      onChange={(v) => handleChangeSelectedForBalance(v)}
                      placeholder="Select account"
                    />
                  </Group>
                  <div style={{ height: 380 }}>
                    {(() => {
                      const series = balanceSeries();
                      const allY = series.flatMap((s: any) => (s.data || []).map((p: any) => Number(p.y)));
                      const lowest = allY.length ? Math.min(...allY) : 0;
                      const yMin = lowest - Math.abs(lowest) * 0.15;
                      return (
                        <ResponsiveLine
                          data={series}
                          curve="cardinal"
                          lineWidth={8}
                          enableArea={true}
                          margin={{ top: 10, right: 20, bottom: 40, left: 50 }}
                          xScale={{ type: 'point' }}
                          yScale={{ type: 'linear', min: yMin, max: 'auto' }}
                          areaBaselineValue={yMin}
                          layers={[ 'grid', 'markers', 'areas', 'axes', 'lines', 'points', 'mesh', 'legends' ]}
                          axisBottom={{ tickRotation: 0 }}
                          axisLeft={{}}
                          colors={[ '#228be6' ]}
                          pointSize={8}
                          tooltip={({ point }: any) => {
                            const x = String(point.data.x);
                            const y = Number(point.data.y).toFixed(2);
                            return (
                              <div style={{ background: 'white', padding: '6px 8px', borderRadius: 6, boxShadow: '0 2px 10px rgba(0,0,0,0.1)', border: '1px solid #e9ecef' }}>
                                <div style={{ fontSize: 12, color: '#495057' }}>{x}</div>
                                <div style={{ fontWeight: 600 }}>${y}</div>
                              </div>
                            );
                          }}
                          useMesh
                        />
                      );
                    })()}
                  </div>
                </Stack>
              </Card>
            </Grid.Col>

            {/* Right: Column of per-account debit/credit bar graphs with settings (1/3) */}
            <Grid.Col span={{ base: 12, lg: 4 }}>
              <Stack gap="md">
                {[...accounts].sort((a,b) => a.name.localeCompare(b.name)).map((account) => (
                  <Card key={account.id} shadow="sm" padding="lg" radius="md" withBorder>
                    <Stack gap="sm">
                      <Group justify="space-between" align="center">
                        <Text fw={600}>{account.name}</Text>
                        <Menu shadow="md" width={220} position="bottom-end">
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" size="lg" radius="md" aria-label="Settings">
                              <IconSettings size={18} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item onClick={() => setMonthClear({ open: true, accountId: account.id })}>Clear month…</Menu.Item>
                            <Menu.Item color="red" onClick={() => setConfirm({ open: true, title: 'Clear all data', description: 'This will remove all transactions for this account. This action cannot be undone.', intent: 'clear-all', accountId: account.id })}>Clear all data</Menu.Item>
                            <Divider my="xs" />
                            <Menu.Item color="red" onClick={() => setConfirm({ open: true, title: 'Delete account', description: 'This will delete the account and all its data. This action cannot be undone.', intent: 'delete-account', accountId: account.id })}>Delete account</Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                      {account.historicalBalance.length > 0 && (
                        <div style={{ height: 180 }}>
                          <ResponsiveBar
                            data={formatBarData(account.historicalBalance as any)}
                            keys={["Debits", "Credits"]}
                            indexBy="month"
                            groupMode="grouped"
                            layout="vertical"
                            borderRadius={4}
                            margin={{ top: 10, right: 10, bottom: 30, left: 40 }}
                            padding={0.3}
                            colors={(bar) => (bar.id === 'Debits' ? '#fa5252' : '#37b24d')}
                            axisBottom={{ tickRotation: 0 }}
                            axisLeft={{}}
                            valueFormat={(v) => `$${Number(v).toFixed(2)}`}
                            labelSkipWidth={100}
                            labelSkipHeight={100}
                          />
                        </div>
                      )}
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Grid.Col>
          </Grid>
        )}
      </Stack>

      {/* Create Account Modal */}
      <Modal
        opened={isCreateAccountModalOpen}
        onClose={() => setIsCreateAccountModalOpen(false)}
        title="Create New Account"
        centered
      >
        <form onSubmit={accountForm.onSubmit(handleCreateAccount)}>
          <Stack gap="md">
            <TextInput
              label="Account Name"
              placeholder="Enter account name"
              required
              {...accountForm.getInputProps("name")}
            />
            <NumberInput
              label="Monthly Balance"
              placeholder="0.00"
              decimalScale={2}
              {...accountForm.getInputProps("totalMonthlyBalance")}
            />
            <NumberInput
              label="Monthly Debits"
              placeholder="0.00"
              decimalScale={2}
              {...accountForm.getInputProps("totalMonthlyDebits")}
            />
            <NumberInput
              label="Monthly Credits"
              placeholder="0.00"
              decimalScale={2}
              {...accountForm.getInputProps("totalMonthlyCredits")}
            />
            <Group justify="flex-end">
              <Button
                variant="light"
                onClick={() => setIsCreateAccountModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create Account</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        opened={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title}
        centered
      >
        <Stack gap="md">
          <Text>{confirm?.description}</Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => {
                if (!confirm) return;
                const fd = new FormData();
                fd.set("intent", confirm.intent);
                fd.set("accountId", confirm.accountId);
                fetcher.submit(fd, { method: "post" });
                setConfirm(null);
                setNotification({
                  type: "success",
                  message:
                    confirm.intent === "delete-account"
                      ? "Account deleted"
                      : "All data cleared",
                });
              }}
            >
              Confirm
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Clear specific month modal */}
      <Modal
        opened={!!monthClear}
        onClose={() => setMonthClear(null)}
        title="Clear month data"
        centered
      >
        <Stack gap="md">
          <Select
            label="Select month"
            placeholder="YYYY-MM"
            data={(() => {
              const acct = accounts.find((a) => a.id === monthClear?.accountId);
              const months: string[] = acct
                ? (acct.historicalBalance as any).map((m: any) =>
                    String(m.month)
                  )
                : [];
              return Array.from(new Set(months))
                .sort()
                .reverse()
                .map((m: string) => ({ value: m, label: m }));
            })()}
            value={monthClear?.selected || ""}
            onChange={(v) =>
              setMonthClear((prev) =>
                prev ? { ...prev, selected: v || "" } : prev
              )
            }
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setMonthClear(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => {
                if (!monthClear || !monthClear.selected) return;
                const fd = new FormData();
                fd.set("intent", "clear-month");
                fd.set("accountId", monthClear.accountId);
                fd.set("month", monthClear.selected);
                fetcher.submit(fd, { method: "post" });
                setMonthClear(null);
                setNotification({
                  type: "success",
                  message: "Selected month cleared",
                });
              }}
            >
              Clear
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Upload QIF Modal */}
      <Modal
        opened={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload QIF File"
        centered
      >
        <Stack gap="md">
          <Select
            label="Select Account"
            placeholder="Choose an account"
            data={accounts.map((account) => ({
              value: account.id,
              label: account.name,
            }))}
            value={selectedAccountForUpload}
            onChange={(value) => setSelectedAccountForUpload(value || "")}
            required
          />
          <FileInput
            label="QIF File"
            placeholder="Choose a QIF file"
            accept=".qif"
            onChange={handleFileUpload}
            required
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setIsUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUploadTransactions}
              disabled={
                !selectedAccountForUpload || !uploadedFile || isUploading
              }
              loading={isUploading}
            >
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
