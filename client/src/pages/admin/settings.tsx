import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Brain, Mail, Users, Shield, Plus, Trash2, Save, Pencil } from "lucide-react";
import logoPath from "@assets/medqrown_logo.png";

export default function AdminSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: admin } = useQuery<any>({ queryKey: ["/api/admin/me"] });
  const { data: providers } = useQuery<any[]>({ queryKey: ["/api/ai-providers"] });
  const { data: templates } = useQuery<any[]>({ queryKey: ["/api/email-templates"] });
  const { data: admins } = useQuery<any[]>({ queryKey: ["/api/admins"] });

  if (!admin) {
    setLocation("/admin");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/3">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <img src={logoPath} alt="MedQrown" className="h-10 w-auto object-contain" data-testid="img-logo" />
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <h1 className="text-lg font-bold flex-1">Settings</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="ai">
          <TabsList className="mb-6 h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="ai" className="text-xs gap-1"><Brain className="w-3 h-3" />AI Providers</TabsTrigger>
            <TabsTrigger value="email" className="text-xs gap-1"><Mail className="w-3 h-3" />Email Templates</TabsTrigger>
            <TabsTrigger value="admins" className="text-xs gap-1"><Users className="w-3 h-3" />Admin Roles</TabsTrigger>
            <TabsTrigger value="password" className="text-xs gap-1"><Shield className="w-3 h-3" />Password</TabsTrigger>
          </TabsList>

          <TabsContent value="ai"><AiProvidersSection providers={providers || []} /></TabsContent>
          <TabsContent value="email"><EmailTemplatesSection templates={templates || []} /></TabsContent>
          <TabsContent value="admins"><AdminsSection admins={admins || []} isSuperAdmin={admin.role === "super_admin"} /></TabsContent>
          <TabsContent value="password"><ChangePasswordSection /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function AiProvidersSection({ providers }: { providers: any[] }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", type: "openai", apiKeyEnv: "", apiKeyValue: "", baseUrlEnv: "",
    endpoint: "", model: "", weight: 1
  });

  const resetForm = () => {
    setForm({ name: "", type: "openai", apiKeyEnv: "", apiKeyValue: "", baseUrlEnv: "", endpoint: "", model: "", weight: 1 });
    setEditingId(null);
  };

  const addProvider = useMutation({
    mutationFn: async () => {
      const { apiKeyValue, ...rest } = form;
      await apiRequest("POST", "/api/ai-providers", { ...rest, apiKeyValue: apiKeyValue || undefined, isActive: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-providers"] });
      setShowAdd(false);
      resetForm();
      toast({ title: "Provider added" });
    },
  });

  const updateProvider = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const { apiKeyValue, ...rest } = form;
      if (apiKeyValue && rest.apiKeyEnv) {
        await apiRequest("POST", "/api/ai-providers/set-key", { envVarName: rest.apiKeyEnv, apiKeyValue });
      }
      await apiRequest("PATCH", `/api/ai-providers/${editingId}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-providers"] });
      setEditingId(null);
      resetForm();
      toast({ title: "Provider updated" });
    },
  });

  const toggleProvider = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/ai-providers/${id}`, { isActive });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ai-providers"] }),
  });

  const deleteProvider = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/ai-providers/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ai-providers"] }),
  });

  const startEdit = (p: any) => {
    setForm({
      name: p.name, type: p.type, apiKeyEnv: p.apiKeyEnv || "",
      baseUrlEnv: p.baseUrlEnv || "", endpoint: p.endpoint || "",
      model: p.model || "", weight: p.weight
    });
    setEditingId(p.id);
    setShowAdd(true);
  };

  const formContent = (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. GPT-4o Custom" data-testid="input-provider-name" />
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="openai, gemini, anthropic, or any custom type" data-testid="input-provider-type" />
        <p className="text-xs text-muted-foreground">Enter any type name (openai, gemini, anthropic, llama, mistral, etc.)</p>
      </div>
      <div className="space-y-2">
        <Label>API Key Env Variable</Label>
        <Input value={form.apiKeyEnv} onChange={(e) => setForm({ ...form, apiKeyEnv: e.target.value })} placeholder="e.g. OPENROUTER_API_KEY" data-testid="input-provider-apiKeyEnv" />
        <p className="text-xs text-muted-foreground">Name of the environment variable to store the API key</p>
      </div>
      <div className="space-y-2">
        <Label>API Key Value {editingId ? "(leave empty to keep current)" : ""}</Label>
        <Input type="password" value={form.apiKeyValue} onChange={(e) => setForm({ ...form, apiKeyValue: e.target.value })} placeholder={editingId ? "••••••••" : "sk-..."} data-testid="input-provider-apiKeyValue" />
        <p className="text-xs text-muted-foreground">The actual API key. It will be stored securely as an environment variable on the server.</p>
      </div>
      <div className="space-y-2">
        <Label>Base URL Env Variable (optional)</Label>
        <Input value={form.baseUrlEnv} onChange={(e) => setForm({ ...form, baseUrlEnv: e.target.value })} placeholder="AI_INTEGRATIONS_OPENAI_BASE_URL" />
      </div>
      <div className="space-y-2">
        <Label>Custom Endpoint URL (optional, overrides env var)</Label>
        <Input value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="https://api.openai.com/v1" data-testid="input-provider-endpoint" />
        <p className="text-xs text-muted-foreground">Direct endpoint URL. Takes priority over Base URL Env Variable.</p>
      </div>
      <div className="space-y-2">
        <Label>Custom Model Name (optional)</Label>
        <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="gpt-4o, claude-3-opus, gemini-pro, etc." data-testid="input-provider-model" />
        <p className="text-xs text-muted-foreground">Leave empty for default model per type</p>
      </div>
      <div className="space-y-2">
        <Label>Weight (for load distribution)</Label>
        <Input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: parseInt(e.target.value) || 1 })} />
        <p className="text-xs text-muted-foreground">Higher weight = more marking work assigned</p>
      </div>
      <Button className="w-full" onClick={() => editingId ? updateProvider.mutate() : addProvider.mutate()} disabled={!form.name || addProvider.isPending || updateProvider.isPending}>
        {editingId ? (updateProvider.isPending ? "Updating..." : "Update Provider") : (addProvider.isPending ? "Adding..." : "Add Provider")}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">AI Providers</h3>
          <p className="text-sm text-muted-foreground">Configure multiple AI providers with custom endpoints and models</p>
        </div>
        <Dialog open={showAdd} onOpenChange={(v) => { setShowAdd(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild><Button size="sm" data-testid="button-add-provider"><Plus className="w-3 h-3 mr-1" />Add Provider</Button></DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Edit AI Provider" : "Add AI Provider"}</DialogTitle></DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
      </div>

      {providers.map((p: any) => (
        <Card key={p.id} className="shadow-sm" data-testid={`card-provider-${p.id}`}>
          <CardContent className="py-3 px-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-medium">{p.name}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline">{p.type}</Badge>
                <span className="text-xs text-muted-foreground">Weight: {p.weight}</span>
                {p.model && <span className="text-xs text-muted-foreground">Model: {p.model}</span>}
                {p.endpoint && <span className="text-xs text-muted-foreground truncate max-w-[200px]">Endpoint: {p.endpoint}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={p.isActive} onCheckedChange={(checked) => toggleProvider.mutate({ id: p.id, isActive: checked })} />
              <Button variant="ghost" size="icon" onClick={() => startEdit(p)} data-testid={`button-edit-provider-${p.id}`}>
                <Pencil className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteProvider.mutate(p.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PlaceholderEditor({ placeholders, onChange }: { placeholders: Record<string, string>; onChange: (p: Record<string, string>) => void }) {
  const [newKey, setNewKey] = useState("");

  const builtInKeys = ["student_name", "exam_name", "email", "password", "portal_link"];
  const allKeys = [...builtInKeys, ...Object.keys(placeholders || {}).filter(k => !builtInKeys.includes(k))];
  const current = placeholders || {};

  const updateValue = (key: string, value: string) => {
    const updated = { ...current };
    if (value) {
      updated[key] = value;
    } else {
      delete updated[key];
    }
    onChange(updated);
  };

  const addCustom = () => {
    if (!newKey || allKeys.includes(newKey)) return;
    const cleanKey = newKey.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
    onChange({ ...current, [cleanKey]: "" });
    setNewKey("");
  };

  const removeCustom = (key: string) => {
    const updated = { ...current };
    delete updated[key];
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Placeholder Values</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Override the default auto-filled values, or add your own custom placeholders. Leave empty to use the automatic value.
      </p>

      <div className="space-y-2">
        {builtInKeys.map(key => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-36 shrink-0">
              <Badge variant="outline" className="text-xs font-mono">{`{${key}}`}</Badge>
            </div>
            <Input
              value={current[key] || ""}
              onChange={(e) => updateValue(key, e.target.value)}
              placeholder={
                key === "student_name" ? "Auto: student's name" :
                key === "exam_name" ? "Auto: exam title" :
                key === "email" ? "Auto: student's email" :
                key === "password" ? "Auto: student's password" :
                key === "portal_link" ? "Auto: site URL" : ""
              }
              className="text-sm h-9"
              data-testid={`input-placeholder-${key}`}
            />
          </div>
        ))}

        {Object.keys(current).filter(k => !builtInKeys.includes(k)).map(key => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-36 shrink-0">
              <Badge variant="secondary" className="text-xs font-mono">{`{${key}}`}</Badge>
            </div>
            <Input
              value={current[key] || ""}
              onChange={(e) => updateValue(key, e.target.value)}
              placeholder={`Value for {${key}}`}
              className="text-sm h-9"
              data-testid={`input-placeholder-${key}`}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={() => removeCustom(key)} data-testid={`button-remove-placeholder-${key}`}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="new_placeholder_name"
          className="text-sm h-9 font-mono"
          data-testid="input-new-placeholder-key"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
        />
        <Button variant="outline" size="sm" className="shrink-0 text-xs h-9" onClick={addCustom} disabled={!newKey} data-testid="button-add-placeholder">
          <Plus className="w-3 h-3 mr-1" />Add
        </Button>
      </div>
    </div>
  );
}

function EmailTemplatesSection({ templates }: { templates: any[] }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<{ name: string; subject: string; body: string; placeholders: Record<string, string> }>({ name: "", subject: "", body: "", placeholders: {} });

  const createTemplate = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/email-templates", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      setShowCreate(false);
      setForm({ name: "", subject: "", body: "", placeholders: {} });
      toast({ title: "Template created" });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/email-templates/${editing.id}`, {
        name: editing.name, subject: editing.subject, body: editing.body,
        placeholders: editing.placeholders || {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      setEditing(null);
      toast({ title: "Template updated" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Email Templates</h3>
          <p className="text-sm text-muted-foreground">
            Use placeholders like {"{student_name}"}, {"{exam_name}"}, etc. in your templates.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Emails sent via Gmail SMTP (medqrownmedicalsolutions24@gmail.com)
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button size="sm" data-testid="button-new-template"><Plus className="w-3 h-3 mr-1" />New Template</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Email Template</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2"><Label>Template Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-template-name" /></div>
              <div className="space-y-2"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} data-testid="input-template-subject" /></div>
              <div className="space-y-2"><Label>Body</Label><Textarea className="min-h-[150px]" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} data-testid="textarea-template-body" /></div>
              <PlaceholderEditor placeholders={form.placeholders} onChange={(p) => setForm({ ...form, placeholders: p })} />
              <Button className="w-full h-11" onClick={() => createTemplate.mutate()} disabled={createTemplate.isPending} data-testid="button-create-template">
                {createTemplate.isPending ? "Creating..." : "Create Template"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {editing && (
        <Card className="shadow-sm border-primary/10">
          <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 py-2.5 border-b border-primary/5">
            <h4 className="text-sm font-semibold">Editing: {editing.name}</h4>
          </div>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2"><Label>Template Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Subject</Label><Input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} /></div>
            <div className="space-y-2"><Label>Body</Label><Textarea className="min-h-[200px]" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></div>
            <PlaceholderEditor
              placeholders={editing.placeholders || {}}
              onChange={(p) => setEditing({ ...editing, placeholders: p })}
            />
            <div className="flex gap-2">
              <Button onClick={() => updateTemplate.mutate()} disabled={updateTemplate.isPending} data-testid="button-save-template"><Save className="w-3 h-3 mr-1" />Save</Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {templates.map((t: any) => {
        const hasCustomPlaceholders = t.placeholders && Object.keys(t.placeholders).length > 0;
        return (
          <Card key={t.id} className="shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setEditing({ ...t, placeholders: t.placeholders || {} })}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">Subject: {t.subject}</p>
                </div>
                {hasCustomPlaceholders && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {Object.keys(t.placeholders).length} custom value{Object.keys(t.placeholders).length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AdminsSection({ admins, isSuperAdmin }: { admins: any[]; isSuperAdmin: boolean }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "examiner" });

  const createAdmin = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admins", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admins"] });
      setShowAdd(false);
      setForm({ name: "", email: "", password: "", role: "examiner" });
      toast({ title: "Admin created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Admin Roles</h3>
          <p className="text-sm text-muted-foreground">Manage admin accounts and roles</p>
        </div>
        {isSuperAdmin && (
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-3 h-3 mr-1" />Add Admin</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Admin</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="examiner">Examiner</SelectItem>
                      <SelectItem value="reviewer">Reviewer</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => createAdmin.mutate()} disabled={createAdmin.isPending}>Create Admin</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {admins.map((a: any) => (
        <Card key={a.id}>
          <CardContent className="py-3 flex items-center justify-between gap-3">
            <div><p className="text-sm font-medium">{a.name}</p><p className="text-xs text-muted-foreground">{a.email}</p></div>
            <Badge variant="outline">{a.role.replace("_", " ")}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChangePasswordSection() {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");

  const changePassword = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/change-password", { currentPassword: current, newPassword: newPass });
    },
    onSuccess: () => { setCurrent(""); setNewPass(""); toast({ title: "Password changed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-md space-y-4">
      <Card>
        <CardHeader><h3 className="font-medium">Change Password</h3></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Current Password</Label><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
          <div className="space-y-2"><Label>New Password</Label><Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} /></div>
          <Button onClick={() => changePassword.mutate()} disabled={!current || !newPass || changePassword.isPending}>
            {changePassword.isPending ? "Changing..." : "Change Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
