import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { LogIn } from "lucide-react";
import logoPath from "@assets/medqrown_logo.png";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/admin/login", { email, password });
      setLocation("/admin/dashboard");
    } catch (error: any) {
      toast({ title: "Login Failed", description: "Invalid email or password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <header className="px-4 sm:px-6 py-4">
        <img src={logoPath} alt="MedQrown Logo" className="h-12 w-auto object-contain" data-testid="img-logo" />
      </header>

      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={logoPath} alt="MedQrown" className="h-32 w-auto mx-auto mb-4 object-contain" />
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-title">MedQrown MedEazy</h1>
            <p className="text-muted-foreground mt-1 text-sm">Admin Portal</p>
          </div>

          <Card className="border-primary/10 shadow-lg">
            <CardContent className="p-6">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11"
                    data-testid="input-password"
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-sm font-medium" disabled={loading} data-testid="button-login">
                  <LogIn className="w-4 h-4 mr-2" />
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-5">
            <a href="/" className="hover:text-primary transition-colors underline underline-offset-2" data-testid="link-student-portal">Go to Student Portal</a>
          </p>
        </div>
      </div>
    </div>
  );
}
