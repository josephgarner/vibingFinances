import type {
  MetaFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { useEffect, useState } from "react";
import {
  Container,
  Title,
  Card,
  Stack,
  Text,
  Group,
  Button,
  Table,
  Modal,
  TextInput,
  Notification,
} from "@mantine/core";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useParams,
} from "@remix-run/react";
import {
  getAccountBook,
  getCategoryRules,
  createCategoryRule,
  applyRulesToUncategorized,
} from "../utils/database";

export const meta: MetaFunction = () => {
  return [
    { title: "Rules - Personal Finances" },
    { name: "description", content: "Category rules management" },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const accountBookId = params.accountBookId as string;
  const [book, rules] = await Promise.all([
    getAccountBook(accountBookId),
    getCategoryRules(accountBookId),
  ]);
  return json({ accountBookName: book?.name || "", rules });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const accountBookId = params.accountBookId as string;
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as any;
    if (body.intent === "create-rule") {
      const created = await createCategoryRule(
        accountBookId,
        body.keyword,
        body.category,
        body.subCategory || ""
      );
      return json({ ok: true, rule: created });
    }
    if (body.intent === "apply-rules") {
      const count = await applyRulesToUncategorized(accountBookId);
      return json({ ok: true, updated: count });
    }
    return json({ ok: false, error: "Unknown intent" }, { status: 400 });
  }
  return json({ ok: false, error: "Invalid request" }, { status: 400 });
}

export default function RulesPage() {
  const { accountBookId } = useParams();
  const navigate = useNavigate();
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [rules, setRules] = useState((loaderData as any).rules as any[]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({
    keyword: "",
    category: "",
    subCategory: "",
  });
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "pf_active_book_name",
        (loaderData as any).accountBookName || ""
      );
    }
  }, [loaderData]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && (fetcher.data as any).ok) {
      if ((fetcher.data as any).rule) {
        setRules((prev) => [...prev, (fetcher.data as any).rule]);
        setIsCreateOpen(false);
        setForm({ keyword: "", category: "", subCategory: "" });
        setNotification({ type: "success", message: "Rule created" });
      } else if (typeof (fetcher.data as any).updated === "number") {
        setNotification({
          type: "success",
          message: `Applied rules to ${
            (fetcher.data as any).updated
          } transactions`,
        });
      }
    }
  }, [fetcher.state, fetcher.data]);

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
          <Title order={1}>Category Rules</Title>
          <Group>
            <Button variant="filled" onClick={() => setIsCreateOpen(true)}>
              Add Rule
            </Button>
            <Button
              variant="light"
              onClick={() =>
                fetcher.submit({ intent: "apply-rules" } as any, {
                  method: "post",
                  encType: "application/json",
                })
              }
            >
              Apply to Uncategorized
            </Button>
          </Group>
        </Group>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            {rules.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                No rules yet. Add your first rule.
              </Text>
            ) : (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Keyword</Table.Th>
                    <Table.Th>Category</Table.Th>
                    <Table.Th>Sub Category</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rules.map((r) => (
                    <Table.Tr key={r.id}>
                      <Table.Td>{r.keyword}</Table.Td>
                      <Table.Td>{r.category}</Table.Td>
                      <Table.Td>{r.subCategory}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        </Card>
      </Stack>

      <Modal
        opened={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Rule"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Keyword"
            placeholder="e.g. amazon"
            value={form.keyword}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, keyword: e.currentTarget.value }))
            }
          />
          <TextInput
            label="Category"
            placeholder="e.g. Shopping"
            value={form.category}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, category: e.currentTarget.value }))
            }
          />
          <TextInput
            label="Sub Category"
            placeholder="e.g. Online"
            value={form.subCategory}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                subCategory: e.currentTarget.value,
              }))
            }
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                fetcher.submit({ intent: "create-rule", ...form } as any, {
                  method: "post",
                  encType: "application/json",
                });
              }}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
