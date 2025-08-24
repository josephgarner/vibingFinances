import type {
  MetaFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { useEffect, useMemo, useState } from "react";
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
  Combobox,
  useCombobox,
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
  getDistinctCategories,
  getDistinctSubCategories,
} from "../utils/database";

export const meta: MetaFunction = () => {
  return [
    { title: "Rules - Personal Finances" },
    { name: "description", content: "Category rules management" },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const accountBookId = params.accountBookId as string;
  const [book, rules, categories, subCategories] = await Promise.all([
    getAccountBook(accountBookId),
    getCategoryRules(accountBookId),
    getDistinctCategories(accountBookId),
    getDistinctSubCategories(accountBookId),
  ]);
  return json({ accountBookName: book?.name || "", rules, categories, subCategories });
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
  const [categories] = useState<string[]>(
    ((loaderData as any).categories || []) as string[]
  );
  const [subCategories] = useState<string[]>(
    ((loaderData as any).subCategories || []) as string[]
  );
  const [form, setForm] = useState({
    keyword: "",
    category: "",
    subCategory: "",
  });
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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
          <CreatableSelect
            label="Category"
            placeholder="Choose or create a category"
            data={categories}
            value={form.category}
            onChange={(v) => setForm((prev) => ({ ...prev, category: v }))}
          />
          <CreatableSelect
            label="Sub Category"
            placeholder="Choose or create a sub category"
            data={subCategories}
            value={form.subCategory}
            onChange={(v) => setForm((prev) => ({ ...prev, subCategory: v }))}
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
