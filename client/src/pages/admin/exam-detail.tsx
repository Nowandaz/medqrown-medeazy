import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Users, FileText, Trophy, BarChart3, MessageSquare, Brain,
  Settings, Plus, Trash2, Send, RotateCcw, UserPlus, Eye,
  CheckCircle, Clock, AlertCircle, Mail, Upload, Image as ImageIcon,
  Loader2, XCircle, Star
} from "lucide-react";
import logoPath from "@assets/medqrown_logo.png";

export default function AdminExamDetail() {
  const [, params] = useRoute("/admin/exams/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const examId = parseInt(params?.id || "0");
  const [activeTab, setActiveTab] = useState("overview");

  const { data: exam, isLoading } = useQuery<any>({ queryKey: ["/api/exams", examId] });
  const { data: examStudents } = useQuery<any[]>({ queryKey: ["/api/exams", examId, "students"] });
  const { data: examQuestions } = useQuery<any[]>({ queryKey: ["/api/exams", examId, "questions"] });
  const { data: rankings } = useQuery<any[]>({ queryKey: ["/api/exams", examId, "rankings"], enabled: activeTab === "rankings" });
  const { data: analytics } = useQuery<any[]>({ queryKey: ["/api/exams", examId, "analytics"], enabled: activeTab === "analytics" });
  const { data: feedback } = useQuery<any[]>({ queryKey: ["/api/exams", examId, "feedback"], enabled: activeTab === "feedback" });
  const { data: examResponses } = useQuery<any[]>({ queryKey: ["/api/exams", examId, "responses"], enabled: activeTab === "marking" });
  const { data: emailTemplates } = useQuery<any[]>({ queryKey: ["/api/email-templates"], enabled: activeTab === "emails" });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Exam not found</p>
      </div>
    );
  }

  const stats = exam.stats || { total: 0, submitted: 0, inProgress: 0, notStarted: 0 };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/3">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <img src={logoPath} alt="MedQrown" className="h-10 w-auto object-contain shrink-0" data-testid="img-logo" />
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold truncate" data-testid="text-exam-title">{exam.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={exam.status === "active" ? "default" : "secondary"} className="text-xs gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${exam.status === "active" ? "bg-green-500" : "bg-yellow-500"}`} />
                {exam.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {exam.timerMode === "per_question" ? `${exam.perQuestionSeconds}s/question` :
                 exam.timerMode === "full_exam" ? `${Math.floor((exam.fullExamSeconds || 0) / 60)}min` :
                 "No timer"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="overview" className="text-xs gap-1" data-testid="tab-overview">
              <Eye className="w-3 h-3" />Overview
            </TabsTrigger>
            <TabsTrigger value="students" className="text-xs gap-1" data-testid="tab-students">
              <Users className="w-3 h-3" />Students
            </TabsTrigger>
            <TabsTrigger value="questions" className="text-xs gap-1" data-testid="tab-questions">
              <FileText className="w-3 h-3" />Questions
            </TabsTrigger>
            <TabsTrigger value="rankings" className="text-xs gap-1" data-testid="tab-rankings">
              <Trophy className="w-3 h-3" />Rankings
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs gap-1" data-testid="tab-analytics">
              <BarChart3 className="w-3 h-3" />Analytics
            </TabsTrigger>
            <TabsTrigger value="feedback" className="text-xs gap-1" data-testid="tab-feedback">
              <MessageSquare className="w-3 h-3" />Feedback
            </TabsTrigger>
            <TabsTrigger value="marking" className="text-xs gap-1" data-testid="tab-marking">
              <Brain className="w-3 h-3" />AI Marking
            </TabsTrigger>
            <TabsTrigger value="emails" className="text-xs gap-1" data-testid="tab-emails">
              <Mail className="w-3 h-3" />Emails
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs gap-1" data-testid="tab-settings">
              <Settings className="w-3 h-3" />Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab stats={stats} examStudents={examStudents || []} examId={examId} exam={exam} />
          </TabsContent>
          <TabsContent value="students">
            <StudentsTab examId={examId} examStudents={examStudents || []} />
          </TabsContent>
          <TabsContent value="questions">
            <QuestionsTab examId={examId} questions={examQuestions || []} />
          </TabsContent>
          <TabsContent value="rankings">
            <RankingsTab rankings={rankings || []} examId={examId} />
          </TabsContent>
          <TabsContent value="analytics">
            <AnalyticsTab analytics={analytics || []} />
          </TabsContent>
          <TabsContent value="feedback">
            <FeedbackTab feedback={feedback || []} />
          </TabsContent>
          <TabsContent value="marking">
            <MarkingTab examId={examId} responses={examResponses || []} stats={stats} />
          </TabsContent>
          <TabsContent value="emails">
            <EmailsTab examId={examId} examStudents={examStudents || []} templates={emailTemplates || []} />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab exam={exam} examId={examId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function OverviewTab({ stats, examStudents, examId, exam }: any) {
  const { toast } = useToast();
  const releaseResults = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/exams/${examId}`, { resultsReleased: !exam.resultsReleased });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", examId] });
      toast({ title: exam.resultsReleased ? "Results hidden" : "Results released" });
    },
  });

  const toggleAutoMark = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/exams/${examId}`, { autoMarkEnabled: !exam.autoMarkEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", examId] });
      toast({ title: exam.autoMarkEnabled ? "Auto-marking disabled" : "Auto-marking enabled" });
    },
  });

  const completionPercent = stats.total > 0 ? (stats.submitted / stats.total) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Students", value: stats.total, icon: Users, color: "text-primary", bg: "bg-primary/10", testId: "text-total-students" },
          { label: "Submitted", value: stats.submitted, icon: CheckCircle, color: "text-green-600", bg: "bg-green-500/10", testId: "text-submitted" },
          { label: "In Progress", value: stats.inProgress, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-500/10", testId: "text-in-progress" },
          { label: "Not Started", value: stats.notStarted, icon: AlertCircle, color: "text-muted-foreground", bg: "bg-muted", testId: "text-not-started" },
        ].map((item) => (
          <Card key={item.label} className="shadow-sm">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${item.bg}`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid={item.testId}>{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.total > 0 && (
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Completion Rate</span>
              <span className="text-muted-foreground">{stats.submitted}/{stats.total} ({completionPercent.toFixed(0)}%)</span>
            </div>
            <Progress value={completionPercent} className="h-2" />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={() => releaseResults.mutate()}
          disabled={releaseResults.isPending}
          variant={exam.resultsReleased ? "secondary" : "default"}
          className="shadow-sm"
          data-testid="button-release-results"
        >
          {exam.resultsReleased ? (
            <><Eye className="w-4 h-4 mr-1.5" />Hide Results</>
          ) : (
            <><Eye className="w-4 h-4 mr-1.5" />Release Results</>
          )}
        </Button>
        {exam.resultsReleased && (
          <Badge variant="default" className="bg-green-600 text-xs">Results Released</Badge>
        )}
      </div>

      <Card className="shadow-sm">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-Mark SAQ on Submission</p>
              <p className="text-xs text-muted-foreground mt-0.5">When enabled, AI will automatically mark short answer questions as soon as a student submits their exam</p>
            </div>
            <Switch
              checked={exam.autoMarkEnabled || false}
              onCheckedChange={() => toggleAutoMark.mutate()}
              disabled={toggleAutoMark.isPending}
              data-testid="switch-auto-mark"
            />
          </div>
          {exam.autoMarkEnabled && (
            <Badge variant="default" className="bg-primary text-xs mt-2">Auto-marking active</Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StudentsTab({ examId, examStudents }: { examId: number; examStudents: any[] }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const addStudent = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/exams/${examId}/students`, { name, email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", examId, "students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exams", examId] });
      setShowAdd(false);
      setName("");
      setEmail("");
      toast({ title: "Student added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeStudent = useMutation({
    mutationFn: async (esId: number) => {
      await apiRequest("DELETE", `/api/exams/${examId}/students/${esId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", examId, "students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exams", examId] });
    },
  });

  const resetAttempt = useMutation({
    mutationFn: async (esId: number) => {
      await apiRequest("POST", `/api/exams/${examId}/students/${esId}/reset`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", examId, "students"] });
      toast({ title: "Attempt reset" });
    },
  });

  const sendEmails = async () => {
    setSending(true);
    try {
      const res = await apiRequest("POST", `/api/exams/${examId}/send-emails`, {});
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/exams", examId, "students"] });
      toast({ title: `Emails: ${data.sent} sent, ${data.failed} failed` });
    } catch (e: any) {
      toast({ title: "Email sending failed", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "submitted": return <Badge variant="default" className="text-xs gap-1"><CheckCircle className="w-3 h-3" />Submitted</Badge>;
      case "in_progress": return <Badge variant="secondary" className="text-xs gap-1"><Clock className="w-3 h-3" />In Progress</Badge>;
      default: return <Badge variant="outline" className="text-xs gap-1"><AlertCircle className="w-3 h-3" />Not Started</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold">Students</h3>
          <p className="text-xs text-muted-foreground">{examStudents.length} enrolled</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={sendEmails} disabled={sending} className="text-xs" data-testid="button-send-emails">
            <Mail className="w-3.5 h-3.5 mr-1" />
            {sending ? "Sending..." : "Send All Emails"}
          </Button>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="text-xs" data-testid="button-add-student"><UserPlus className="w-3.5 h-3.5 mr-1" />Add Student</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Student</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="h-11" data-testid="input-student-name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" className="h-11" data-testid="input-student-email" />
                </div>
                <Button className="w-full h-11" onClick={() => addStudent.mutate()} disabled={!name || !email || addStudent.isPending} data-testid="button-submit-student">
                  {addStudent.isPending ? "Adding..." : "Add Student"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {examStudents.length === 0 ? (
        <Card className="border-dashed border-2 shadow-none">
          <CardContent className="py-10 text-center">
            <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No students added yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {examStudents.map((es: any) => (
            <Card key={es.id} className="shadow-sm" data-testid={`card-student-${es.id}`}>
              <CardContent className="py-3 px-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{es.student?.name}</p>
                  <p className="text-xs text-muted-foreground">{es.student?.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Password: <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{es.password}</code>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {statusBadge(es.attemptStatus)}
                  {es.emailSent && <Badge variant="outline" className="text-xs gap-1"><Mail className="w-3 h-3" />Sent</Badge>}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => resetAttempt.mutate(es.id)} title="Reset attempt" data-testid={`button-reset-${es.id}`}>
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeStudent.mutate(es.id)} data-testid={`button-remove-${es.id}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionsTab({ examId, questions }: { examId: number; questions: any[] }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [qType, setQType] = useState("mcq");
  const [qContent, setQContent] = useState("");
  const [qMarks, setQMarks] = useState(1);
  const [qExpected, setQExpected] = useState("");
  const [hasSubQ, setHasSubQ] = useState(false);
  const [subQCount, setSubQCount] = useState(2);
  const [subQs, setSubQs] = useState<{ content: string; marks: number; expectedAnswer: string }[]>([]);
  const [options, setOptions] = useState([
    { content: "", isCorrect: false },
    { content: "", isCorrect: false },
    { content: "", isCorrect: false },
    { content: "", isCorrect: false },
  ]);
  const [imageUrl, setImageUrl] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const urlRes = await apiRequest("POST", "/api/uploads/request-url", {
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
      const urlData = await urlRes.json();

      await fetch(urlData.uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      setImageUrl(urlData.objectPath);
      toast({ title: "Image uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const addQuestion = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/exams/${examId}/questions`, {
        type: qType,
        content: qContent,
        marks: qMarks,
        expectedAnswer: qType === "saq" ? qExpected : undefined,
        hasSubquestions: hasSubQ,
        imageUrl: imageUrl || undefined,
        imageCaption: imageCaption || undefined,
        options: qType === "mcq" ? options : undefined,
        subquestions: hasSubQ ? subQs : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", examId, "questions"] });
      setShowAdd(false);
      resetForm();
      toast({ title: "Question added" });
    },
  });

  const deleteQuestion = useMutation({
    mutationFn: async (qId: number) => {
      await apiRequest("DELETE", `/api/exams/${examId}/questions/${qId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", examId, "questions"] });
    },
  });

  function resetForm() {
    setQContent("");
    setQMarks(1);
    setQExpected("");
    setHasSubQ(false);
    setSubQs([]);
    setImageUrl("");
    setImageCaption("");
    setOptions([
      { content: "", isCorrect: false },
      { content: "", isCorrect: false },
      { content: "", isCorrect: false },
      { content: "", isCorrect: false },
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold">Questions</h3>
          <p className="text-xs text-muted-foreground">{questions.length} question{questions.length !== 1 ? "s" : ""}</p>
        </div>
        <Dialog open={showAdd} onOpenChange={(v) => { setShowAdd(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="text-xs" data-testid="button-add-question"><Plus className="w-3.5 h-3.5 mr-1" />Add Question</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Question</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select value={qType} onValueChange={setQType}>
                  <SelectTrigger data-testid="select-question-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Multiple Choice</SelectItem>
                    <SelectItem value="saq">Short Answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Question</Label>
                <Textarea value={qContent} onChange={(e) => setQContent(e.target.value)} placeholder="Enter the question..." data-testid="input-question-content" />
              </div>
              <div className="space-y-2">
                <Label>Marks</Label>
                <Input type="number" value={qMarks} onChange={(e) => setQMarks(parseInt(e.target.value) || 1)} data-testid="input-question-marks" />
              </div>

              <div className="space-y-2">
                <Label>Image (optional)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file);
                  }}
                />
                {imageUrl ? (
                  <div className="space-y-2">
                    <div className="relative rounded-xl border overflow-hidden bg-muted/30 p-2">
                      <img src={imageUrl} alt="Question image" className="max-w-full max-h-48 object-contain mx-auto rounded-lg" data-testid="img-preview" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-3 right-3 h-7 w-7 rounded-lg"
                        onClick={() => setImageUrl("")}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Image Description (sent to AI for SAQ marking)</Label>
                      <Input
                        value={imageCaption}
                        onChange={(e) => setImageCaption(e.target.value)}
                        placeholder="Describe the image for AI context..."
                        data-testid="input-image-caption"
                      />
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    data-testid="button-upload-image"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                    {uploading ? "Uploading..." : "Upload Image"}
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={hasSubQ} onCheckedChange={(checked) => {
                  setHasSubQ(checked);
                  if (checked) setSubQs(Array(subQCount).fill(null).map(() => ({ content: "", marks: 1, expectedAnswer: "" })));
                  else setSubQs([]);
                }} data-testid="switch-subquestions" />
                <Label>Has Subquestions?</Label>
              </div>

              {hasSubQ && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Number of Subquestions</Label>
                    <Input type="number" value={subQCount} onChange={(e) => {
                      const count = parseInt(e.target.value) || 1;
                      setSubQCount(count);
                      setSubQs(Array(count).fill(null).map((_, i) => subQs[i] || { content: "", marks: 1, expectedAnswer: "" }));
                    }} />
                  </div>
                  {subQs.map((sq, i) => (
                    <Card key={i} className="shadow-sm">
                      <CardContent className="pt-4 space-y-2">
                        <Label className="text-xs font-semibold">Sub-question {i + 1}</Label>
                        <Textarea value={sq.content} onChange={(e) => {
                          const copy = [...subQs]; copy[i] = { ...copy[i], content: e.target.value }; setSubQs(copy);
                        }} placeholder="Enter sub-question..." />
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Marks</Label>
                            <Input type="number" value={sq.marks} onChange={(e) => {
                              const copy = [...subQs]; copy[i] = { ...copy[i], marks: parseInt(e.target.value) || 1 }; setSubQs(copy);
                            }} />
                          </div>
                          <div className="flex-[2] space-y-1">
                            <Label className="text-xs">Expected Answer</Label>
                            <Input value={sq.expectedAnswer} onChange={(e) => {
                              const copy = [...subQs]; copy[i] = { ...copy[i], expectedAnswer: e.target.value }; setSubQs(copy);
                            }} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {qType === "mcq" && !hasSubQ && (
                <div className="space-y-3">
                  <Label>Answer Choices</Label>
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground w-5">{String.fromCharCode(65 + i)}</span>
                      <Input value={opt.content} onChange={(e) => {
                        const copy = [...options]; copy[i] = { ...copy[i], content: e.target.value }; setOptions(copy);
                      }} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="flex-1" />
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch checked={opt.isCorrect} onCheckedChange={(checked) => {
                          const copy = options.map((o, j) => ({ ...o, isCorrect: j === i ? checked : false }));
                          setOptions(copy);
                        }} />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Correct</span>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setOptions([...options, { content: "", isCorrect: false }])}>
                    <Plus className="w-3 h-3 mr-1" />Add Option
                  </Button>
                </div>
              )}

              {qType === "saq" && !hasSubQ && (
                <div className="space-y-2">
                  <Label>Expected Answer (to guide AI marking)</Label>
                  <Textarea value={qExpected} onChange={(e) => setQExpected(e.target.value)} placeholder="Enter the expected answer..." data-testid="input-expected-answer" />
                </div>
              )}

              <Button className="w-full h-11" onClick={() => addQuestion.mutate()} disabled={!qContent || addQuestion.isPending} data-testid="button-submit-question">
                {addQuestion.isPending ? "Adding..." : "Add Question"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {questions.length === 0 ? (
        <Card className="border-dashed border-2 shadow-none">
          <CardContent className="py-10 text-center">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No questions added yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q: any, idx: number) => (
            <Card key={q.id} className="shadow-sm overflow-hidden" data-testid={`card-question-${q.id}`}>
              <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 py-2 border-b border-primary/5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {idx + 1}
                    </span>
                    <Badge variant="outline" className="text-xs bg-background">{q.type.toUpperCase()}</Badge>
                    <span className="text-xs text-muted-foreground">{q.marks} mark{q.marks > 1 ? "s" : ""}</span>
                    {q.imageUrl && <Badge variant="outline" className="text-xs bg-background gap-0.5"><ImageIcon className="w-3 h-3" />Image</Badge>}
                    {q.hasSubquestions && <Badge variant="outline" className="text-xs bg-background">{q.subquestions?.length || 0} sub-q</Badge>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteQuestion.mutate(q.id)} data-testid={`button-delete-q-${q.id}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{q.content}</p>

                {q.imageUrl && (
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <img
                      src={q.imageUrl}
                      alt={q.imageCaption || "Question image"}
                      className="max-w-sm max-h-40 rounded-lg object-contain mx-auto"
                      data-testid={`img-question-${q.id}`}
                    />
                    {q.imageCaption && <p className="text-xs text-muted-foreground mt-2 text-center italic">{q.imageCaption}</p>}
                  </div>
                )}

                {q.options?.length > 0 && (
                  <div className="space-y-1">
                    {q.options.map((o: any, i: number) => (
                      <div key={o.id} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${o.isCorrect ? "bg-green-500/10 text-green-700 font-medium" : "text-muted-foreground"}`}>
                        <span className="font-semibold">{String.fromCharCode(65 + i)}.</span>
                        <span>{o.content}</span>
                        {o.isCorrect && <CheckCircle className="w-3 h-3 ml-auto shrink-0" />}
                      </div>
                    ))}
                  </div>
                )}

                {q.subquestions?.length > 0 && (
                  <div className="space-y-1.5 pl-4 border-l-2 border-primary/20">
                    {q.subquestions.map((sq: any, i: number) => (
                      <div key={sq.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">
                          {String.fromCharCode(97 + i)}
                        </span>
                        <span>{sq.content}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{sq.marks}m</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RankingsTab({ rankings, examId }: { rankings: any[]; examId: number }) {
  const top3 = rankings.slice(0, 3);
  const rest = rankings.slice(3);

  const podiumOrder = [1, 0, 2];
  const podiumConfig = [
    { height: "h-20", size: "w-20 h-20", ring: "ring-yellow-500/30 border-yellow-500", bg: "bg-yellow-500/15", text: "text-yellow-600", trophy: "text-yellow-600", label: "1st" },
    { height: "h-14", size: "w-16 h-16", ring: "ring-gray-400/20 border-gray-400", bg: "bg-gray-300/20", text: "text-gray-500", trophy: "text-gray-500", label: "2nd" },
    { height: "h-10", size: "w-14 h-14", ring: "ring-orange-500/20 border-orange-500", bg: "bg-orange-500/15", text: "text-orange-600", trophy: "text-orange-500", label: "3rd" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Rankings</h3>
          <p className="text-xs text-muted-foreground">{rankings.length} student{rankings.length !== 1 ? "s" : ""} ranked</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/exams", examId, "rankings"] })} data-testid="button-refresh-rankings">
          <RotateCcw className="w-3.5 h-3.5 mr-1" />Refresh
        </Button>
      </div>

      {rankings.length === 0 ? (
        <Card className="border-dashed border-2 shadow-none">
          <CardContent className="py-10 text-center">
            <Trophy className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No rankings available yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-yellow-500 via-gray-300 to-orange-500" />
            <CardContent className="pt-6 pb-4">
              <div className="flex items-end justify-center gap-4 py-4">
                {podiumOrder.map((rank) => {
                  const student = top3[rank];
                  if (!student) return null;
                  const cfg = podiumConfig[rank];
                  return (
                    <div key={rank} className="text-center flex flex-col items-center" data-testid={`podium-${rank === 0 ? "1st" : rank === 1 ? "2nd" : "3rd"}`}>
                      <div className={`${cfg.size} rounded-full ${cfg.bg} border-2 ${cfg.ring} ring-4 flex items-center justify-center mb-2`}>
                        <Trophy className={`w-5 h-5 ${cfg.trophy}`} />
                      </div>
                      <p className="text-xs font-semibold truncate max-w-[90px]">{student.studentName}</p>
                      <p className={`text-lg font-bold ${cfg.text}`}>{student.percentage.toFixed(1)}%</p>
                      <p className="text-[10px] text-muted-foreground">{student.totalScore}/{student.maxScore}</p>
                      <div className={`w-20 ${cfg.height} ${cfg.bg} rounded-t-lg mt-2 flex items-center justify-center`}>
                        <span className={`text-xs font-bold ${cfg.text}`}>{cfg.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {rest.length > 0 && (
            <div className="space-y-2">
              {rest.map((r: any, i: number) => (
                <Card key={i} className="shadow-sm" data-testid={`card-rank-${i + 3}`}>
                  <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-muted text-muted-foreground">
                        {i + 4}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{r.studentName}</p>
                        <p className="text-xs text-muted-foreground">{r.studentEmail}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{r.totalScore}/{r.maxScore}</p>
                      <p className="text-xs text-muted-foreground">{r.percentage.toFixed(1)}%</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AnalyticsTab({ analytics }: { analytics: any[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Performance by Question</h3>
        <p className="text-xs text-muted-foreground">{analytics.length} question{analytics.length !== 1 ? "s" : ""} analyzed</p>
      </div>
      {analytics.length === 0 ? (
        <Card className="border-dashed border-2 shadow-none">
          <CardContent className="py-10 text-center">
            <BarChart3 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No analytics data available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {analytics.map((a: any) => {
            const correctRate = a.totalAttempts > 0 ? (a.correctCount / a.totalAttempts) * 100 : 0;
            return (
              <Card key={a.questionId} className="shadow-sm overflow-hidden" data-testid={`card-analytic-${a.questionId}`}>
                <CardContent className="py-3 px-4">
                  <p className="text-sm mb-2 line-clamp-2 leading-relaxed">{a.content}</p>
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    <Badge variant="outline" className="text-xs">{a.type.toUpperCase()}</Badge>
                    <span className="text-muted-foreground">{a.totalAttempts} attempts</span>
                    <span className="text-muted-foreground">Avg: {a.avgMarks.toFixed(1)}</span>
                    {a.totalAttempts > 0 && (
                      <Badge variant={correctRate >= 50 ? "default" : "destructive"} className="text-xs ml-auto">
                        {correctRate.toFixed(0)}% correct
                      </Badge>
                    )}
                  </div>
                  {a.totalAttempts > 0 && (
                    <div className="mt-2">
                      <Progress value={correctRate} className="h-1.5" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FeedbackTab({ feedback }: { feedback: any[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Student Feedback</h3>
        <p className="text-xs text-muted-foreground">{feedback.length} response{feedback.length !== 1 ? "s" : ""}</p>
      </div>
      {feedback.length === 0 ? (
        <Card className="border-dashed border-2 shadow-none">
          <CardContent className="py-10 text-center">
            <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No feedback received yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {feedback.map((fb: any) => (
            <Card key={fb.id} className="shadow-sm">
              <CardContent className="py-3 px-4">
                <p className="text-sm leading-relaxed">{fb.content}</p>
                <div className="flex items-center justify-between mt-2">
                  {fb.rating && (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= fb.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/20"}`} />
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{new Date(fb.createdAt).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MarkingTab({ examId, responses, stats }: { examId: number; responses: any[]; stats: any }) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [isMarking, setIsMarking] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  const { data: jobs } = useQuery<any[]>({ queryKey: ["/api/exams", examId, "marking-jobs"] });

  const saqResponses = responses.filter((r: any) => r.questionType === "saq");
  const unmarked = saqResponses.filter((r: any) => r.isCorrect === null && r.answer);
  const marked = saqResponses.filter((r: any) => r.isCorrect !== null);
  const total = saqResponses.filter((r: any) => r.answer);

  const markIndividual = useMutation({
    mutationFn: async (responseId: number) => {
      const res = await apiRequest("POST", `/api/responses/${responseId}/mark`, { prompt: prompt || undefined });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", examId, "responses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exams", examId, "rankings"] });
      toast({ title: "Response marked" });
    },
    onError: (e: any) => toast({ title: "Marking failed", description: e.message, variant: "destructive" }),
  });

  const startMarking = async () => {
    setIsMarking(true);
    setProgress({ completed: 0, total: 0 });
    try {
      const response = await fetch(`/api/exams/${examId}/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt || undefined }),
        credentials: "include",
      });
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "progress") setProgress({ completed: event.completed, total: event.total });
            if (event.type === "complete") {
              toast({ title: `Marking complete: ${event.totalMarked} responses marked` });
              queryClient.invalidateQueries({ queryKey: ["/api/exams", examId, "marking-jobs"] });
              queryClient.invalidateQueries({ queryKey: ["/api/exams", examId, "responses"] });
              queryClient.invalidateQueries({ queryKey: ["/api/exams", examId, "rankings"] });
            }
            if (event.type === "error") toast({ title: "Error", description: event.message, variant: "destructive" });
          } catch {}
        }
      }
    } catch (e: any) {
      toast({ title: "Marking failed", description: e.message, variant: "destructive" });
    } finally {
      setIsMarking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Submitted Exams", value: stats.submitted, color: "text-primary" },
          { label: "Marked SAQ", value: marked.length, color: "text-green-600" },
          { label: "Unmarked SAQ", value: unmarked.length, color: "text-yellow-600" },
        ].map((item) => (
          <Card key={item.label} className="shadow-sm">
            <CardContent className="pt-5 pb-4 text-center">
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {total.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Marking Progress</span>
              <span className="text-muted-foreground">{marked.length}/{total.length} ({total.length > 0 ? ((marked.length / total.length) * 100).toFixed(0) : 0}%)</span>
            </div>
            <Progress value={total.length > 0 ? (marked.length / total.length) * 100 : 0} className="h-2" />
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm border-primary/10">
        <CardHeader className="pb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Batch AI Marking
          </h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Custom Marking Prompt (optional)</Label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Leave empty for default prompt..." className="bg-background" />
          </div>
          {isMarking && (
            <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Batch progress</span>
                <span>{progress.completed}/{progress.total}</span>
              </div>
              <Progress value={progress.total > 0 ? (progress.completed / progress.total) * 100 : 0} className="h-2" />
            </div>
          )}
          <Button onClick={startMarking} disabled={isMarking || unmarked.length === 0} className="shadow-sm" data-testid="button-start-marking">
            <Brain className="w-4 h-4 mr-1.5" />
            {isMarking ? "Marking in progress..." : `Mark All Unmarked (${unmarked.length})`}
          </Button>
        </CardContent>
      </Card>

      {saqResponses.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Individual SAQ Responses</h4>
          {saqResponses.filter((r: any) => r.answer).map((r: any) => (
            <Card key={r.id} className="shadow-sm overflow-hidden" data-testid={`card-response-${r.id}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{r.studentName}</span>
                      <span className="text-xs text-muted-foreground">{r.studentEmail}</span>
                      {r.isCorrect === true && <Badge variant="default" className="text-xs gap-0.5"><CheckCircle className="w-3 h-3" />Correct</Badge>}
                      {r.isCorrect === false && <Badge variant="destructive" className="text-xs gap-0.5"><XCircle className="w-3 h-3" />Incorrect</Badge>}
                      {r.isCorrect === null && <Badge variant="outline" className="text-xs">Unmarked</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{r.questionContent}</p>
                    {r.subquestionContent && <p className="text-xs text-muted-foreground pl-3 border-l-2 border-primary/20">{r.subquestionContent}</p>}
                    <div className="bg-muted/40 p-2.5 rounded-lg border">
                      <p className="text-sm">{r.answer}</p>
                    </div>
                    {r.aiFeedback && (
                      <div className="bg-primary/5 p-2.5 rounded-lg border border-primary/10">
                        <p className="text-xs text-muted-foreground italic leading-relaxed">{r.aiFeedback}</p>
                      </div>
                    )}
                    {r.marksAwarded != null && <p className="text-xs font-medium">Marks: {r.marksAwarded}</p>}
                  </div>
                  {r.isCorrect === null && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shrink-0 text-xs"
                      onClick={() => markIndividual.mutate(r.id)}
                      disabled={markIndividual.isPending}
                      data-testid={`button-mark-${r.id}`}
                    >
                      <Brain className="w-3 h-3 mr-1" />Mark
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {jobs && jobs.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3"><h3 className="font-semibold text-sm">Marking History</h3></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {jobs.map((job: any) => (
                <div key={job.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{job.completedItems}/{job.totalItems} items</p>
                    <p className="text-xs text-muted-foreground">{new Date(job.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge variant={job.status === "completed" ? "default" : "secondary"} className="text-xs">{job.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmailsTab({ examId, examStudents, templates }: { examId: number; examStudents: any[]; templates: any[] }) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<any>(null);

  const activeTemplate = templates.find(t => String(t.id) === selectedTemplate);

  const handleTemplateChange = (val: string) => {
    setSelectedTemplate(val);
    if (val === "custom") {
      setUseCustom(true);
    } else {
      setUseCustom(false);
      const tmpl = templates.find(t => String(t.id) === val);
      if (tmpl) {
        setCustomSubject(tmpl.subject);
        setCustomBody(tmpl.body);
      }
    }
  };

  const toggleStudent = (id: number) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
    setSelectAll(false);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedStudentIds([]);
    }
  };

  const sendEmails = async () => {
    setSending(true);
    setResults(null);
    try {
      const payload: any = {};
      if (!selectAll && selectedStudentIds.length > 0) {
        payload.studentIds = selectedStudentIds;
      }
      if (useCustom) {
        payload.customSubject = customSubject;
        payload.customBody = customBody;
      } else if (selectedTemplate) {
        payload.templateId = parseInt(selectedTemplate);
      }

      const res = await apiRequest("POST", `/api/exams/${examId}/send-emails`, payload);
      const data = await res.json();
      setResults(data);
      queryClient.invalidateQueries({ queryKey: ["/api/exams", examId, "students"] });
      toast({ title: `Emails sent: ${data.sent} delivered, ${data.failed} failed` });
    } catch (e: any) {
      toast({ title: "Email sending failed", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const targetCount = selectAll ? examStudents.length : selectedStudentIds.length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold">Send Emails</h3>
        <p className="text-sm text-muted-foreground">Send emails to exam students using templates or write custom messages.</p>
      </div>

      <Card className="shadow-sm border-primary/10">
        <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 py-2.5 border-b border-primary/5">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</span>
            Choose Template
          </h4>
        </div>
        <CardContent className="p-4 space-y-4">
          <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
            <SelectTrigger data-testid="select-email-template">
              <SelectValue placeholder="Select a template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
              <SelectItem value="custom">Write custom email</SelectItem>
            </SelectContent>
          </Select>

          {activeTemplate && !useCustom && (
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</p>
              <p className="text-sm"><strong>Subject:</strong> {activeTemplate.subject}</p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{activeTemplate.body}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Placeholders: {"{student_name}"}, {"{exam_name}"}, {"{email}"}, {"{password}"}, {"{portal_link}"}
              </p>
            </div>
          )}

          {useCustom && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="e.g. CAT Reminder - {exam_name}"
                  data-testid="input-custom-subject"
                />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  placeholder="Dear {student_name},..."
                  className="min-h-[150px] bg-background"
                  data-testid="textarea-custom-body"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Placeholders: {"{student_name}"}, {"{exam_name}"}, {"{email}"}, {"{password}"}, {"{portal_link}"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 py-2.5 border-b border-primary/5">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</span>
            Select Recipients
          </h4>
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Switch checked={selectAll} onCheckedChange={handleSelectAll} data-testid="switch-select-all" />
            <Label>Send to all students ({examStudents.length})</Label>
          </div>

          {!selectAll && (
            <div className="space-y-1 max-h-60 overflow-y-auto border rounded-xl p-3">
              {examStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No students added to this exam yet.</p>
              ) : (
                examStudents.map((es: any) => (
                  <label key={es.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(es.id)}
                      onChange={() => toggleStudent(es.id)}
                      className="rounded"
                      data-testid={`checkbox-student-${es.id}`}
                    />
                    <span className="text-sm">{es.student?.name}</span>
                    <span className="text-xs text-muted-foreground">({es.student?.email})</span>
                    {es.emailSent && <Badge variant="outline" className="text-xs ml-auto gap-0.5"><Mail className="w-3 h-3" />Sent</Badge>}
                  </label>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 py-2.5 border-b border-primary/5">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</span>
            Send
          </h4>
        </div>
        <CardContent className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {targetCount} student{targetCount !== 1 ? "s" : ""} will receive this email via Gmail SMTP.
          </p>
          <Button
            onClick={sendEmails}
            disabled={sending || targetCount === 0 || (!selectedTemplate && !useCustom) || (useCustom && (!customSubject || !customBody))}
            className="shadow-sm"
            data-testid="button-send-emails"
          >
            {sending ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Sending...</>
            ) : (
              <><Send className="w-4 h-4 mr-1.5" />Send to {targetCount} Student{targetCount !== 1 ? "s" : ""}</>
            )}
          </Button>

          {results && (
            <Card className="mt-2 shadow-sm border-primary/10">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <Badge variant="default" className="text-xs">{results.sent} sent</Badge>
                  {results.failed > 0 && <Badge variant="destructive" className="text-xs">{results.failed} failed</Badge>}
                  <span className="text-xs text-muted-foreground">{results.total} total</span>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {results.emails?.map((em: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                      <span>{em.studentName} ({em.email})</span>
                      <Badge variant={em.status === "sent" ? "default" : "destructive"} className="text-xs gap-0.5">
                        {em.status === "sent" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {em.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsTab({ exam, examId }: { exam: any; examId: number }) {
  const { toast } = useToast();
  const [timerMode, setTimerMode] = useState(exam.timerMode);
  const [perQ, setPerQ] = useState(exam.perQuestionSeconds || 60);
  const [fullExam, setFullExam] = useState(exam.fullExamSeconds || 3600);

  const updateSettings = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/exams/${examId}`, {
        timerMode,
        perQuestionSeconds: timerMode === "per_question" ? perQ : null,
        fullExamSeconds: timerMode === "full_exam" ? fullExam : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", examId] });
      toast({ title: "Settings saved" });
    },
  });

  return (
    <div className="max-w-lg space-y-4">
      <Card className="shadow-sm border-primary/10">
        <CardHeader className="pb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            Timer Settings
          </h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Timer Mode</Label>
            <Select value={timerMode} onValueChange={setTimerMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Timer</SelectItem>
                <SelectItem value="per_question">Per Question</SelectItem>
                <SelectItem value="full_exam">Full Exam</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {timerMode === "per_question" && (
            <div className="space-y-2">
              <Label>Seconds Per Question</Label>
              <Input type="number" value={perQ} onChange={(e) => setPerQ(parseInt(e.target.value) || 60)} />
            </div>
          )}
          {timerMode === "full_exam" && (
            <div className="space-y-2">
              <Label>Total Exam Time (seconds)</Label>
              <Input type="number" value={fullExam} onChange={(e) => setFullExam(parseInt(e.target.value) || 3600)} />
              <p className="text-xs text-muted-foreground">{Math.floor(fullExam / 60)} minutes</p>
            </div>
          )}
          <Button onClick={() => updateSettings.mutate()} disabled={updateSettings.isPending} className="shadow-sm" data-testid="button-save-settings">
            {updateSettings.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
