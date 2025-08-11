import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useEffect, useState } from "react";
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
  Badge,
  Notification,
  Grid,
  Image,
  Paper,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useFetcher, useLoaderData, useNavigate, useNavigation } from "@remix-run/react";
import { 
  getAccountBooks, 
  createAccountBook,
  type DatabaseAccountBook 
} from "../utils/database";

export const meta: MetaFunction = () => {
  return [
    { title: "Personal Finances - Account Books" },
    { name: "description", content: "Manage your personal finances with multiple account books" },
  ];
};

export async function loader(_args: LoaderFunctionArgs) {
  const books = await getAccountBooks();
  return json({ accountBooks: books });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "create-account-book") {
    const name = (formData.get("name") || "").toString().trim();
    if (name.length < 2) {
      return json({ ok: false, error: "Name must be at least 2 characters" }, { status: 400 });
    }
    const created = await createAccountBook(name);
    return json({ ok: true, accountBook: created });
  }
  return json({ ok: false, error: "Unknown intent" }, { status: 400 });
}

export default function Index() {
  const navigate = useNavigate();
  const loaderData = useLoaderData<typeof loader>();
  const [accountBooks, setAccountBooks] = useState<DatabaseAccountBook[]>(loaderData.accountBooks);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";
  const fetcher = useFetcher<typeof action>();

  const form = useForm({
    initialValues: {
      name: "",
    },
    validate: {
      name: (value) => (value.length < 2 ? "Name must be at least 2 characters" : null),
    },
  });

  // Load account books on component mount
  useEffect(() => {
    setAccountBooks(loaderData.accountBooks);
    setIsLoading(false);
  }, [loaderData.accountBooks]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && (fetcher.data as any).ok && (fetcher.data as any).accountBook) {
      const newBook = (fetcher.data as any).accountBook as DatabaseAccountBook;
      setAccountBooks((prev) => [...prev, newBook]);
      setIsCreateModalOpen(false);
      form.reset();
      setNotification({ type: 'success', message: 'Account book created successfully!' });
    } else if (fetcher.state === "idle" && fetcher.data && (fetcher.data as any).ok === false) {
      const errMsg = (fetcher.data as any).error || 'Failed to create account book.';
      setNotification({ type: 'error', message: errMsg });
    }
  }, [fetcher.state, fetcher.data]);

  const handleSelectAccountBook = (accountBook: DatabaseAccountBook) => {
    navigate(`/dashboard/${accountBook.id}`);
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {notification && (
          <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
            <Notification
              title={notification.type === 'success' ? 'Success' : 'Error'}
              color={notification.type === 'success' ? 'green' : 'red'}
              onClose={() => setNotification(null)}
              withCloseButton
            >
              {notification.message}
            </Notification>
          </div>
        )}

        {/* Page header */}
        <Stack gap={4}>
          <Title order={1} style={{ fontSize: 36 }}>Account Books</Title>
          <Text c="dimmed">Choose an account book to view your financial data.</Text>
        </Stack>
        
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="lg">
            <Group justify="space-between" align="center">
              <div />
              <Button onClick={() => setIsCreateModalOpen(true)}>Create New</Button>
            </Group>

            {isLoading ? (
              <Text c="dimmed" ta="center" py="xl">
                Loading account books...
              </Text>
            ) : accountBooks.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                No account books found. Create your first account book to get started.
              </Text>
            ) : (
              <Grid gutter="lg">
                {/* Create New tile */}
                <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                  <Card withBorder radius="md" padding="md" style={{ height: '100%' }} onClick={() => setIsCreateModalOpen(true)}>
                    <Stack gap="sm">
                      <Paper radius="md" withBorder h={180} style={{
                        background: 'linear-gradient(135deg, #f1f5f0 0%, #eaf3ea 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderStyle: 'dashed'
                      }}>
                        <Text fw={700} c="green">＋</Text>
                      </Paper>
                      <Text fw={600}>Create Account Book</Text>
                      <Text c="dimmed" size="sm">Start a new space to manage accounts and transactions.</Text>
                    </Stack>
                  </Card>
                </Grid.Col>

                {accountBooks.map((accountBook) => (
                  <Grid.Col key={accountBook.id} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                    <Card 
                      shadow="xs"
                      padding="md"
                      radius="md"
                      withBorder
                      style={{ cursor: 'pointer', height: '100%' }}
                      aria-label={`Open ${accountBook.name}`}
                      onClick={() => handleSelectAccountBook(accountBook)}
                    >
                      <Stack gap="sm">
                        <Paper radius="md" withBorder h={180} style={{
                          background: 'linear-gradient(135deg, #f7efe7 0%, #f1e7df 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Image src="/logo-light.png" alt="cover" h={100} w={100} fit="contain" />
                        </Paper>
                        <Text fw={600} c="dark">{accountBook.name}</Text>
                        <Text c="dimmed" size="sm">Last updated {new Date(accountBook.updatedAt).toLocaleDateString()}</Text>
                      </Stack>
                    </Card>
                  </Grid.Col>
                ))}
              </Grid>
            )}
          </Stack>
        </Card>
      </Stack>

      <Modal 
        opened={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Account Book"
        centered
      >
        <fetcher.Form method="post">
          <Stack gap="md">
            <TextInput
              label="Account Book Name"
              placeholder="Enter account book name"
              required
              name="name"
              {...form.getInputProps("name")}
            />
            <input type="hidden" name="intent" value="create-account-book" />
            <Group justify="flex-end">
              <Button variant="light" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={fetcher.state !== "idle"}>
                {fetcher.state !== "idle" ? 'Creating...' : 'Create Account Book'}
              </Button>
            </Group>
          </Stack>
        </fetcher.Form>
      </Modal>
    </Container>
  );
}
