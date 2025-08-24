import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData, useParams } from "@remix-run/react";
import {
  Container,
  Grid,
  Card,
  Stack,
  Title,
  TextInput,
  NumberInput,
  Button,
  Group,
  Select,
  Notification,
} from "@mantine/core";
import {
  getFlowBudgets,
  createFlowBudget,
  updateFlowBudget,
  deleteFlowBudget,
  getAccountsByAccountBook,
} from "../utils/database";
import type { FlowBudget, DatabaseAccount } from "../utils/database";
import { ResponsiveSankey } from "@nivo/sankey";

export const meta: MetaFunction = () => [{ title: "Flow Budget" }];

export async function loader({ params }: LoaderFunctionArgs) {
  const accountBookId = params.accountBookId as string;
  const [budgets, accounts] = await Promise.all([
    getFlowBudgets(accountBookId),
    getAccountsByAccountBook(accountBookId),
  ]);
  return json({ budgets, accounts, accountBookId });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const accountBookId = params.accountBookId as string;
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "create" || intent === "update") {
    const id = (formData.get("id") || "").toString();
    const name = (formData.get("name") || "").toString();
    const incomeAccountId =
      (formData.get("incomeAccountId") || "").toString() || null;
    const incomeAmount = Number(
      (formData.get("incomeAmount") || "0").toString()
    );
    const rules = JSON.parse((formData.get("rules") || "[]").toString());
    if (intent === "create") {
      const created = await createFlowBudget(
        accountBookId,
        name,
        incomeAccountId,
        incomeAmount,
        rules
      );
      return json({ ok: true, created });
    }
    await updateFlowBudget(id, name, incomeAccountId, incomeAmount, rules);
    return json({ ok: true });
  }
  if (intent === "delete") {
    const id = (formData.get("id") || "").toString();
    await deleteFlowBudget(id);
    return json({ ok: true });
  }
  return json({ ok: false }, { status: 400 });
}

type Rule = {
  label: string;
  accountId?: string;
  kind: "fixed" | "percent";
  amount: number;
};

export default function FlowBudget() {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const [budgets, setBudgets] = useState<FlowBudget[]>(loaderData.budgets);
  const [selectedId, setSelectedId] = useState<string | null>(
    budgets[0]?.id || null
  );
  const [name, setName] = useState<string>(budgets[0]?.name || "New Budget");
  const [incomeAccountId, setIncomeAccountId] = useState<string | null>(
    budgets[0]?.incomeAccountId || null
  );
  const [incomeAmount, setIncomeAmount] = useState<number>(
    budgets[0]?.incomeAmount || 0
  );
  const [rules, setRules] = useState<Rule[]>(budgets[0]?.rules || []);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!fetcher.data) return;
    if ((fetcher.data as any).created) {
      const created = (fetcher.data as any).created;
      setBudgets((prev: FlowBudget[]) => [created, ...prev]);
      setSelectedId(created.id);
      setNotification({ type: "success", message: "Budget saved" });
    } else if ((fetcher.data as any).ok) {
      if (selectedId)
        setBudgets((prev: FlowBudget[]) =>
          prev.map((b: FlowBudget) =>
            b.id === selectedId
              ? { ...b, name, incomeAccountId, incomeAmount, rules }
              : b
          )
        );
      setNotification({ type: "success", message: "Saved" });
    }
  }, [fetcher.data]);

  const accountOptions = loaderData.accounts.map((a: DatabaseAccount) => ({
    value: a.id,
    label: a.name,
  }));
  const currency = useMemo(
    () =>
      new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }),
    []
  );

  const addRule = () =>
    setRules([...rules, { label: "", kind: "percent", amount: 0 }]);
  const removeRule = (i: number) =>
    setRules(rules.filter((_, idx) => idx !== i));

  const save = (asNew: boolean) => {
    const fd = new FormData();
    fd.set("intent", asNew ? "create" : "update");
    if (!asNew && selectedId) fd.set("id", selectedId);
    fd.set("name", name);
    fd.set("incomeAccountId", incomeAccountId || "");
    fd.set("incomeAmount", String(incomeAmount));
    fd.set("rules", JSON.stringify(rules));
    fetcher.submit(fd, { method: "post" });
  };

  const sankeyData = useMemo(() => {
    const nodes: { id: string }[] = [];
    const links: { source: string; target: string; value: number }[] = [];
    const incomeNode = `Income: ${currency.format(incomeAmount)}`;
    nodes.push({ id: incomeNode });
    let allocatedTotal = 0;
    for (const r of rules) {
      const targetLabel = r.accountId
        ? loaderData.accounts.find((a: DatabaseAccount) => a.id === r.accountId)
            ?.name || r.label
        : r.label;
      nodes.push({ id: targetLabel });
      const value =
        r.kind === "fixed" ? r.amount : incomeAmount * (r.amount / 100);
      const v = Math.max(0, value);
      allocatedTotal += v;
      links.push({ source: incomeNode, target: targetLabel, value: v });
    }
    const surplus = Math.max(0, incomeAmount - allocatedTotal);
    if (surplus > 0.0001) {
      const savingsLabel = "Savings";
      nodes.push({ id: savingsLabel });
      links.push({ source: incomeNode, target: savingsLabel, value: surplus });
    }
    return { nodes, links };
  }, [rules, incomeAmount, loaderData.accounts]);

  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
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
        <Title order={1}>Flow Budget</Title>
        <Grid>
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Card radius="md" padding="lg">
              <Stack gap="md">
                <Group>
                  <TextInput
                    label="Budget name"
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                    style={{ flex: 1 }}
                  />
                  <Button onClick={() => save(!selectedId)}>Save</Button>
                  <Button
                    onClick={() => {
                      setName("New Budget");
                      setIncomeAccountId(null);
                      setIncomeAmount(0);
                      setRules([]);
                      setSelectedId(null);
                    }}
                  >
                    Clear
                  </Button>
                  <Button
                    color="red"
                    onClick={() => {
                      if (!selectedId) return;
                      const fd = new FormData();
                      fd.set("intent", "delete");
                      fd.set("id", selectedId);
                      fetcher.submit(fd, { method: "post" });
                      setBudgets((prev: FlowBudget[]) =>
                        prev.filter((b: FlowBudget) => b.id !== selectedId)
                      );
                      setSelectedId(null);
                    }}
                  >
                    Delete
                  </Button>
                </Group>
                <Group grow>
                  <Select
                    label="Income Account"
                    placeholder="Select account"
                    data={accountOptions}
                    value={incomeAccountId}
                    onChange={setIncomeAccountId}
                    clearable
                  />
                  <NumberInput
                    label="Monthly Income"
                    decimalScale={2}
                    value={incomeAmount}
                    onChange={(v) => setIncomeAmount(Number(v || 0))}
                  />
                </Group>
                <Button onClick={addRule}>Add Bucket</Button>
                {rules.map((r, i) => (
                  <Group key={i} grow>
                    <TextInput
                      label="Label"
                      value={r.label}
                      onChange={(e) => {
                        const next = [...rules];
                        next[i].label = e.currentTarget.value;
                        setRules(next);
                      }}
                    />
                    <Select
                      label="Account (optional)"
                      data={[
                        { value: "", label: "Custom label" },
                        ...accountOptions,
                      ]}
                      value={r.accountId || ""}
                      onChange={(v) => {
                        const next = [...rules];
                        next[i].accountId = v || undefined;
                        setRules(next);
                      }}
                    />
                    <Select
                      label="Type"
                      data={[
                        { value: "fixed", label: "Fixed" },
                        { value: "percent", label: "Percent" },
                      ]}
                      value={r.kind}
                      onChange={(v) => {
                        const next = [...rules];
                        next[i].kind = (v as any) || "fixed";
                        setRules(next);
                      }}
                    />
                    <NumberInput
                      label={r.kind === "fixed" ? "Amount" : "Percent"}
                      rightSection={
                        r.kind === "percent" ? <span>%</span> : undefined
                      }
                      decimalScale={2}
                      value={r.amount}
                      onChange={(v) => {
                        const next = [...rules];
                        const raw = Number(v || 0);
                        if (next[i].kind === "percent") {
                          const sumOthers = next.reduce(
                            (s, rr, idx) =>
                              idx === i || rr.kind !== "percent"
                                ? s
                                : s + (rr.amount || 0),
                            0
                          );
                          const allowed = Math.max(0, 100 - sumOthers);
                          next[i].amount = Math.max(0, Math.min(raw, allowed));
                        } else {
                          next[i].amount = Math.max(0, raw);
                        }
                        setRules(next);
                      }}
                    />
                    <Button color="red" onClick={() => removeRule(i)}>
                      Remove
                    </Button>
                  </Group>
                ))}
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Card radius="md" padding="lg">
              <div style={{ height: 420 }}>
                <ResponsiveSankey
                  data={{
                    nodes: sankeyData.nodes,
                    links: sankeyData.links,
                  }}
                  margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  align="justify"
                  nodeSpacing={18}
                  nodeThickness={10}
                  colors={{ scheme: "category10" }}
                  valueFormat={(v) => currency.format(Number(v))}
                  linkTooltip={({ link }: any) => (
                    <div
                      style={{
                        background: "white",
                        padding: "6px 8px",
                        borderRadius: 6,
                        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                        border: "1px solid #e9ecef",
                      }}
                    >
                      <strong>{currency.format(Number(link.value))}</strong>
                    </div>
                  )}
                />
              </div>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
