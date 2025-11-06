import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Users, Database, Key } from "lucide-react";

interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  createdAt: string;
}

interface DebugData {
  users: User[];
  allKeys: string[];
  count: number;
  totalKeys: number;
}

export default function AdminUsuarios() {
  const { data, isLoading, error } = useQuery<DebugData>({
    queryKey: ["/api/debug/users"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Gerenciar Usuários</h1>
          <p className="text-muted-foreground mt-2">
            Visualize todos os usuários cadastrados no sistema
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Erro ao carregar dados</CardTitle>
            <CardDescription>
              Não foi possível carregar os dados dos usuários. Verifique os logs do servidor.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { users = [], allKeys = [], count = 0, totalKeys = 0 } = data || {};

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">
          Gerenciar Usuários
        </h1>
        <p className="text-muted-foreground mt-2">
          Visualize todos os usuários cadastrados no Replit Database
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">
              {count}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Chaves</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-keys">
              {totalKeys}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Inclui usuários, índices e sessões
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Status</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={totalKeys > 0 ? "default" : "secondary"}>
              {totalKeys > 0 ? "Ativo" : "Vazio"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários Cadastrados</CardTitle>
          <CardDescription>
            Lista de todos os usuários que fizeram login via Google OAuth
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum usuário cadastrado ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Google ID</TableHead>
                  <TableHead>Data de Cadastro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.picture} alt={user.name} />
                          <AvatarFallback>
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium" data-testid={`text-name-${user.id}`}>
                            {user.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ID: {user.id}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-email-${user.id}`}>
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {user.googleId}
                      </code>
                    </TableCell>
                    <TableCell data-testid={`text-created-${user.id}`}>
                      {(() => {
                        try {
                          const date = new Date(user.createdAt);
                          if (isNaN(date.getTime())) return '-';
                          return format(date, "dd/MM/yyyy 'às' HH:mm");
                        } catch {
                          return '-';
                        }
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {allKeys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Todas as Chaves do Database</CardTitle>
            <CardDescription>
              Chaves armazenadas no Replit Database (usuários, índices, sessões)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 font-mono text-xs">
              {allKeys.map((key) => (
                <div
                  key={key}
                  className="bg-muted px-3 py-2 rounded flex items-center justify-between"
                  data-testid={`key-${key}`}
                >
                  <span>{key}</span>
                  <Badge variant="outline" className="text-xs">
                    {key.startsWith('user:') ? 'Usuário' : 
                     key.startsWith('googleId:') ? 'Índice' : 
                     key.startsWith('session:') ? 'Sessão' : 'Outro'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
