import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useEffect, useMemo, useState } from 'react';
import { useFetcher, useLoaderData, useNavigate, useParams } from '@remix-run/react';
import { Container, Grid, Card, Stack, Title, TextInput, NumberInput, Button, Group, Table, Select, Notification } from '@mantine/core';
import { getSplitLists, createSplitList, updateSplitList, deleteSplitList } from '../utils/database';

export const meta: MetaFunction = () => ([{ title: 'Split Payment Calculator' }]);

export async function loader({ params }: LoaderFunctionArgs) {
  const accountBookId = params.accountBookId as string;
  const lists = await getSplitLists(accountBookId);
  return json({ lists, accountBookId });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const accountBookId = params.accountBookId as string;
  const formData = await request.formData();
  const intent = formData.get('intent');
  if (intent === 'create' || intent === 'update') {
    const name = (formData.get('name') || '').toString();
    const items = JSON.parse((formData.get('items') || '[]').toString());
    if (intent === 'create') {
      const created = await createSplitList(accountBookId, name, items);
      return json({ ok: true, created });
    }
    const id = (formData.get('id') || '').toString();
    await updateSplitList(id, name, items);
    return json({ ok: true, updatedAt: new Date().toISOString() });
  }
  if (intent === 'delete') {
    const id = (formData.get('id') || '').toString();
    await deleteSplitList(id);
    return json({ ok: true });
  }
  return json({ ok: false }, { status: 400 });
}

type SplitRow = { name: string; totalAmount: number; splits: { label: string; percent: number }[] };

export default function SplitCalculator() {
  const { accountBookId } = useParams();
  const loaderData = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher<typeof action>();

  const [lists, setLists] = useState(loaderData.lists);
  const [selectedListId, setSelectedListId] = useState<string | null>(lists[0]?.id || null);
  const [name, setName] = useState<string>(lists[0]?.name || 'New Split');
  const [rows, setRows] = useState<SplitRow[]>(lists[0]?.items || []);
  const [globalSplits, setGlobalSplits] = useState<{ label: string; percent: number }[]>([{ label: 'Person 1', percent: 50 }, { label: 'Person 2', percent: 50 }]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!fetcher.data) return;
    if ((fetcher.data as any).created) {
      const created = (fetcher.data as any).created;
      setLists((prev) => [created, ...prev]);
      setSelectedListId(created.id);
      setNotification({ type: 'success', message: 'Split list saved' });
    } else if ((fetcher.data as any).ok) {
      // Update the currently selected list in local state so UI reflects changes without reload
      if (selectedListId) {
        setLists((prev) => prev.map((l) => (l.id === selectedListId ? { ...l, name, items: rows, updatedAt: (fetcher.data as any).updatedAt || l.updatedAt } : l)));
      }
      setNotification({ type: 'success', message: 'Saved' });
    }
  }, [fetcher.data]);

  const totals = useMemo(() => {
    return rows.map((row) => {
      const clampedSplits = row.splits.map((s) => ({ ...s, percent: Math.max(0, Math.min(100, s.percent)) }));
      const sum = clampedSplits.reduce((acc, s) => acc + s.percent, 0);
      return {
        name: row.name,
        total: row.totalAmount,
        splits: clampedSplits.map((s) => ({ label: s.label, percent: s.percent, amount: (row.totalAmount * s.percent) / 100 })),
        percentTotal: sum,
      };
    });
  }, [rows]);

  const listOptions = lists.map((l) => ({ value: l.id, label: l.name }));

  // Initialize global splits from loaded list, if present
  useEffect(() => {
    if (rows.length > 0 && rows[0].splits && rows[0].splits.length > 0) {
      setGlobalSplits(rows[0].splits.map((s) => ({ ...s })));
    }
  }, []);

  const synchronizeRowsWithGlobal = (splits: { label: string; percent: number }[]) => {
    setRows((prev) => prev.map((r) => ({ ...r, splits: splits.map((s) => ({ ...s })) })));
  };
  const handleAddRow = () => setRows([...rows, { name: '', totalAmount: 0, splits: globalSplits.map((s) => ({ ...s })) }]);
  const handleAddSplitGlobal = () => {
    const next = [...globalSplits, { label: `Person ${globalSplits.length + 1}`, percent: 0 }];
    setGlobalSplits(next);
    synchronizeRowsWithGlobal(next);
  };
  const handleRemoveSplitGlobal = (index: number) => {
    const next = globalSplits.filter((_, i) => i !== index);
    setGlobalSplits(next);
    synchronizeRowsWithGlobal(next);
  };
  const handleChangeSplitGlobal = (index: number, field: 'label' | 'percent', value: string | number) => {
    const next = [...globalSplits];
    (next[index] as any)[field] = field === 'percent' ? Number(value) : String(value);
    setGlobalSplits(next);
    synchronizeRowsWithGlobal(next);
  };

  const save = (asNew: boolean) => {
    const fd = new FormData();
    fd.set('intent', asNew ? 'create' : 'update');
    if (!asNew && selectedListId) fd.set('id', selectedListId);
    fd.set('name', name);
    fd.set('items', JSON.stringify(rows));
    fetcher.submit(fd, { method: 'post' });
  };

  const clear = () => {
    setName('New Split');
    setRows([]);
    setSelectedListId(null);
  };

  const del = () => {
    if (!selectedListId) return;
    const fd = new FormData();
    fd.set('intent', 'delete');
    fd.set('id', selectedListId);
    fetcher.submit(fd, { method: 'post' });
    setLists((prev) => prev.filter((l) => l.id !== selectedListId));
    clear();
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        {notification && (
          <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
            <Notification title={notification.type === 'success' ? 'Success' : 'Error'} color={notification.type === 'success' ? 'green' : 'red'} onClose={() => setNotification(null)} withCloseButton>
              {notification.message}
            </Notification>
          </div>
        )}
        <Title order={1}>Split Payment Calculator</Title>
        <Grid>
          {/* Left: editor */}
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Card shadow="sm" withBorder radius="md" padding="lg">
              <Stack gap="md">
                <Group>
                  <TextInput label="List name" value={name} onChange={(e) => setName(e.currentTarget.value)} style={{ flex: 1 }} />
                  <Button onClick={() => save(!selectedListId)}>Save</Button>
                  <Button variant="light" onClick={clear}>Clear</Button>
                  <Button color="red" variant="light" onClick={del} disabled={!selectedListId}>Delete</Button>
                </Group>
                {/* Global splits controller */}

                  <Stack gap={6}>
                    <Group justify="space-between" align="center">
                      <Title order={4}>Splits (applies to all items)</Title>
                      <Button variant="subtle" onClick={handleAddSplitGlobal}>+ Add split</Button>
                    </Group>
                    {globalSplits.map((s, si) => (
                      <Group key={si} gap="xs">
                        <TextInput value={s.label} onChange={(e) => handleChangeSplitGlobal(si, 'label', e.currentTarget.value)} placeholder="Name" style={{ width: 180 }} />
                        <NumberInput rightSection={<span>%</span>} value={s.percent} onChange={(v) => handleChangeSplitGlobal(si, 'percent', Number(v || 0))} />
                        <Button color="red" variant="light" onClick={() => handleRemoveSplitGlobal(si)}>Remove</Button>
                      </Group>
                    ))}
                  </Stack>
                
                <Button onClick={handleAddRow}>Add Item</Button>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Item</Table.Th>
                      <Table.Th>Total</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((row, ri) => (
                      <Table.Tr key={ri}>
                        <Table.Td>
                          <TextInput value={row.name} onChange={(e) => { const copy = [...rows]; copy[ri].name = e.currentTarget.value; setRows(copy); }} placeholder="Item name" />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput decimalScale={2} value={row.totalAmount} onChange={(v) => { const copy = [...rows]; copy[ri].totalAmount = Number(v || 0); setRows(copy); }} />
                        </Table.Td>
                        <Table.Td>
                          <Button color="red" variant="light" onClick={() => setRows(rows.filter((_, i) => i !== ri))}>Remove Item</Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            </Card>
          </Grid.Col>
          {/* Right: saved lists */}
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Card shadow="sm" withBorder radius="md" padding="lg">
              <Stack gap="sm">
                <Title order={3}>Saved Splits</Title>
                <Select placeholder="Select a split" data={listOptions} value={selectedListId} onChange={(v) => {
                  setSelectedListId(v);
                  const found = lists.find((l) => l.id === v);
                  if (found) {
                    setName(found.name);
                    setRows(found.items as any);
                    const firstSplits = (found.items?.[0]?.splits as any) || [];
                    if (firstSplits.length > 0) {
                      setGlobalSplits(firstSplits.map((s: any) => ({ label: String(s.label), percent: Number(s.percent) })));
                    }
                  }
                }} />
                <Stack gap={8}>
                  {lists.map((l) => (
                    <Card key={l.id} withBorder radius="sm" padding="sm" style={{ cursor: 'pointer' }} onClick={() => { setSelectedListId(l.id); setName(l.name); setRows(l.items as any); const fs = (l.items?.[0]?.splits as any) || []; if (fs.length>0) setGlobalSplits(fs.map((s: any) => ({ label: String(s.label), percent: Number(s.percent) }))); }}>
                      <Group justify="space-between">
                        <div>
                          <strong>{l.name}</strong>
                          <div style={{ fontSize: 12, color: '#666' }}>{new Date(l.updatedAt).toLocaleString()}</div>
                        </div>
                        <div>Items: {l.items.length}</div>
                      </Group>
                    </Card>
                  ))}
                </Stack>
                {/* Totals preview */}
                <Title order={4}>Totals Preview</Title>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Item</Table.Th>
                      <Table.Th>Person</Table.Th>
                      <Table.Th>Percent</Table.Th>
                      <Table.Th>Amount</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {totals.flatMap((t) => t.splits.map((s) => (
                      <Table.Tr key={`${t.name}-${s.label}`}>
                        <Table.Td>{t.name}</Table.Td>
                        <Table.Td>{s.label}</Table.Td>
                        <Table.Td>{s.percent.toFixed(2)}%</Table.Td>
                        <Table.Td>${s.amount.toFixed(2)}</Table.Td>
                      </Table.Tr>
                    )))}
                  </Table.Tbody>
                </Table>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}


