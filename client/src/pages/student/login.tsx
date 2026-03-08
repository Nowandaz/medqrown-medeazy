import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { LogIn, Phone, MessageSquare, Mail as MailIcon } from "lucide-react";
import logoPath from "@assets/medqrown_logo.png";

export default function StudentLogin() {
  const [examId, setExamId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: exams, isLoading } = useQuery<{ id: number; title: string }[]>({
    queryKey: ["/api/student/active-exams"],
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examId) {
      toast({ title: "Please select an exam", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/student/login", { examId: parseInt(examId), email, password });
      const data = await res.json();
      if (data.attemptStatus === "submitted") {
        setLocation("/student/results");
      } else {
        setLocation("/student/exam");
      }
    } catch (error: any) {
      toast({ title: "Login Failed", description: "Invalid credentials or exam selection", variant: "destructive" });
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
            <p className="text-muted-foreground mt-1 text-sm">Student Exam Portal</p>
          </div>

          <Card className="border-primary/10 shadow-lg">
            <CardContent className="p-6">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="exam" className="text-sm font-medium">Select Exam</Label>
                  {isLoading ? (
                    <Skeleton className="h-10 rounded-lg" />
                  ) : (
                    <Select value={examId} onValueChange={setExamId}>
                      <SelectTrigger className="h-11" data-testid="select-exam">
                        <SelectValue placeholder="Choose your exam..." />
                      </SelectTrigger>
                      <SelectContent>
                        {exams?.map((exam) => (
                          <SelectItem key={exam.id} value={String(exam.id)}>{exam.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {exams?.length === 0 && (
                    <p className="text-xs text-muted-foreground">No active exams available</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Your registered email"
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
                  {loading ? "Signing in..." : "Sign In to Exam"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-5 bg-primary/5 border-primary/10">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold mb-3 text-foreground">Need Help?</h3>
              <div className="grid gap-2.5">
                <a href="mailto:norysndachule@gmail.com" className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-primary transition-colors group" data-testid="link-email">
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center border group-hover:border-primary/30 transition-colors">
                    <MailIcon className="w-4 h-4" />
                  </div>
                  norysndachule@gmail.com
                </a>
                <a href="tel:0702797977" className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-primary transition-colors group" data-testid="link-phone">
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center border group-hover:border-primary/30 transition-colors">
                    <Phone className="w-4 h-4" />
                  </div>
                  0702797977
                </a>
                <a href="https://wa.me/254702797977" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-primary transition-colors group" data-testid="link-whatsapp">
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center border group-hover:border-primary/30 transition-colors">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  WhatsApp
                </a>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-5">
            <a href="/admin" className="hover:text-primary transition-colors underline underline-offset-2" data-testid="link-admin-portal">Admin Portal</a>
          </p>
        </div>
      </div>
    </div>
  );
}
