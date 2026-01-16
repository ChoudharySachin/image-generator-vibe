import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { bus, type BusEvent } from './bus';
import { commands } from './commands';

function LogEntry({ event }: { event: BusEvent }) {
  const data = event.data as Record<string, unknown>;
  const levelColors: Record<string, string> = {
    log: 'bg-zinc-700',
    info: 'bg-blue-700',
    warn: 'bg-yellow-700',
    error: 'bg-red-700',
  };

  return (
    <div className="font-mono text-xs border-b border-zinc-800 py-1 px-2">
      <span className="text-zinc-500 mr-2">
        {new Date(event.timestamp).toLocaleTimeString()}
      </span>
      <Badge className={`${levelColors[data.level as string] || 'bg-zinc-600'} text-xs mr-2`}>
        {String(data.level || event.type)}
      </Badge>
      <span className="text-zinc-300">
        {(data.args as string[])?.join(' ') || JSON.stringify(data)}
      </span>
    </div>
  );
}

function NetworkEntry({ event }: { event: BusEvent }) {
  const data = event.data as Record<string, unknown>;
  return (
    <div className="font-mono text-xs border-b border-zinc-800 py-1 px-2 flex items-center gap-2">
      <Badge className={data.ok ? 'bg-green-700' : 'bg-red-700'}>{String(data.method)}</Badge>
      <span className="text-zinc-400">{String(data.status || 'ERR')}</span>
      <span className="text-zinc-300 truncate flex-1">{String(data.url)}</span>
      <span className="text-zinc-500">{String(data.duration)}ms</span>
    </div>
  );
}

function StateView({ event }: { event: BusEvent | undefined }) {
  if (!event) return <div className="text-zinc-500 p-4">No state captured yet</div>;
  return (
    <pre className="font-mono text-xs text-zinc-300 p-2 whitespace-pre-wrap">
      {JSON.stringify(event.data, null, 2)}
    </pre>
  );
}

function CommandsView() {
  const cmdList = commands.list();
  const [output, setOutput] = useState<string>('');

  const runCommand = async (name: string) => {
    const result = await commands.execute(name);
    setOutput(`${name}: ${result.success ? 'OK' : result.error}`);
  };

  return (
    <div className="p-2 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {cmdList.map((cmd) => (
          <Button
            key={cmd.name}
            variant="outline"
            size="sm"
            className="text-xs justify-start"
            onClick={() => runCommand(cmd.name)}
          >
            {cmd.name}
          </Button>
        ))}
      </div>
      {output && (
        <div className="font-mono text-xs text-zinc-400 mt-2 p-2 bg-zinc-900 rounded">
          {output}
        </div>
      )}
    </div>
  );
}

export function DevAssistant() {
  const [events, setEvents] = useState<BusEvent[]>(() => bus.getBuffer());
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    const unsub = bus.subscribe((event) => {
      setEvents((prev) => [...prev.slice(-499), event]);
      if (event.type === 'error') {
        setErrorCount((c) => c + 1);
      }
    });

    return unsub;
  }, []);

  const logs = events.filter((e) => e.type === 'log' || e.type === 'error');
  const network = events.filter((e) => e.type === 'network');
  const lastState = events.filter((e) => e.type === 'state').pop();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 right-4 z-50 bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
        >
          Dev
          {errorCount > 0 && (
            <Badge className="ml-2 bg-red-600">{errorCount}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:w-[600px] bg-zinc-950 border-zinc-800">
        <SheetHeader>
          <SheetTitle className="text-zinc-200">Dev Assistant</SheetTitle>
        </SheetHeader>
        <Tabs defaultValue="console" className="mt-4">
          <TabsList className="bg-zinc-900">
            <TabsTrigger value="console">Console</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="state">State</TabsTrigger>
            <TabsTrigger value="commands">Commands</TabsTrigger>
          </TabsList>
          <TabsContent value="console" className="mt-2">
            <ScrollArea className="h-[calc(100vh-200px)] bg-zinc-900 rounded">
              {logs.map((e) => (
                <LogEntry key={e.id} event={e} />
              ))}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="network" className="mt-2">
            <ScrollArea className="h-[calc(100vh-200px)] bg-zinc-900 rounded">
              {network.map((e) => (
                <NetworkEntry key={e.id} event={e} />
              ))}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="state" className="mt-2">
            <ScrollArea className="h-[calc(100vh-200px)] bg-zinc-900 rounded">
              <StateView event={lastState} />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="commands" className="mt-2">
            <ScrollArea className="h-[calc(100vh-200px)] bg-zinc-900 rounded">
              <CommandsView />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
