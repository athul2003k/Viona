"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Building2,
  CheckCircle,
  XCircle,
  Loader2,
  Mail,
  Clock,
  Shield,
  Users,
  Package,
  Warehouse,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getInviteDetails, acceptInvite, declineInvite } from "./actions";
interface InviteDetails {
  inviteId: string;
  orgId: string;
  orgName: string;
  role: string;
  email: string;
  status: string;
  expiresAt: string;
  isExpired: boolean;
  invitedBy: string;
  orgCreatedAt: string;
  orgStats: {
    members: number;
    products: number;
    warehouses: number;
  };
}

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { toast } = useToast();
  const token = params.token as string;

  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load invite details when authenticated
  useEffect(() => {
    if (!token || !isLoaded) return;

    // Only load if user is signed in
    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }

    const loadInvite = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const details = await getInviteDetails(token);
        setInviteDetails(details);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Invalid or expired invitation";
        console.error("Failed to load invite:", err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadInvite();
  }, [token, isLoaded, isSignedIn]);

  // Handle accept invitation
  const handleAccept = async () => {
    if (!inviteDetails) return;

    setIsAccepting(true);
    try {
      const orgId = await acceptInvite(token);

      toast({
        title: "Invitation Accepted",
        description: `Welcome to ${inviteDetails.orgName}!`,
        duration: 5000,
      });

      // Redirect to organization page
      setTimeout(() => {
        router.push(`/organization/${orgId}`);
      }, 1000);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to accept invitation";
      console.error("Failed to accept invite:", err);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setError(errorMessage);
    } finally {
      setIsAccepting(false);
    }
  };

  // Handle decline invitation
  const handleDecline = async () => {
    if (!inviteDetails) return;

    setIsDeclining(true);
    try {
      await declineInvite(token);

      toast({
        title: "Invitation Declined",
        description: "You have declined this invitation",
      });

      setTimeout(() => {
        router.push("/organization");
      }, 1500);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to decline invitation";
      console.error("Failed to decline invite:", err);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeclining(false);
    }
  };

  // Get role badge variant
  const getRoleBadgeVariant = (
    role: string
  ): "destructive" | "default" | "secondary" => {
    switch (role) {
      case "admin":
        return "destructive";
      case "manager":
        return "default";
      default:
        return "secondary";
    }
  };

  // Loading state with layout
  if (!isLoaded || (isSignedIn && isLoading)) {
    return (
            <div className="flex-1 overflow-y-auto flex items-center justify-center p-4">
              <Card className="w-full max-w-2xl">
                <CardHeader className="space-y-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            </div>
    );
  }

  // Not signed in - centered without layout
  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Authentication Required</CardTitle>
                <CardDescription>Sign in to view your invitation</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Secure Invitation</AlertTitle>
              <AlertDescription>
                This is a private invitation link. Please sign in with your account to
                view and accept the invitation.
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Why sign in?</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Verify your identity and email</li>
                <li>Ensure invitation security</li>
                <li>Protect organization data</li>
              </ul>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2">
            <SignInButton mode="modal">
              <Button className="w-full gap-2" size="lg">
                <Shield className="h-4 w-4" />
                Sign In to Continue
              </Button>
            </SignInButton>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => router.push("/organization")}
            >
              Cancel
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Error state with layout
  if (error) {
    const isEmailMismatch = error.toLowerCase().includes("email");
    const isAlreadyMember = error.toLowerCase().includes("already a member");
    const isExpired = error.toLowerCase().includes("expired");

    return (
            <div className="flex-1 overflow-y-auto flex items-center justify-center p-4">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                      <XCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <CardTitle>
                        {isEmailMismatch
                          ? "Email Mismatch"
                          : isAlreadyMember
                          ? "Already a Member"
                          : isExpired
                          ? "Invitation Expired"
                          : "Invalid Invitation"}
                      </CardTitle>
                      <CardDescription>
                        {isEmailMismatch
                          ? "Wrong account detected"
                          : "Cannot process this invitation"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="whitespace-pre-line">
                      {error}
                    </AlertDescription>
                  </Alert>

                  {isEmailMismatch && (
                    <Alert>
                      <AlertTitle>What to do?</AlertTitle>
                      <AlertDescription className="space-y-2 mt-2">
                        <p>1. Sign out of your current account</p>
                        <p>2. Sign in with the invited email address</p>
                        <p>3. Return to this invitation link</p>
                      </AlertDescription>
                    </Alert>
                  )}

                  {isExpired && (
                    <Alert>
                      <AlertDescription>
                        Please contact the organization admin to send you a new
                        invitation.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>

                <CardFooter className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => router.push("/organization")}
                  >
                    Go to Organizations
                  </Button>
                  {isAlreadyMember && inviteDetails && (
                    <Button
                      className="flex-1"
                      onClick={() =>
                        router.push(`/organization/${inviteDetails.orgId}`)
                      }
                    >
                      View Organization
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>
    );
  }

  // Success state - show invite details with layout
  if (!inviteDetails) {
    return null;
  }

  const canAccept = inviteDetails.status === "pending" && !inviteDetails.isExpired;

  return (
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center justify-center min-h-full p-4 md:p-8">
              <Card className="w-full max-w-3xl">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-2">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl md:text-2xl">
                        Organization Invitation
                      </CardTitle>
                      <CardDescription className="text-sm md:text-base mt-1">
                        You&apos;ve been invited to join{" "}
                        <strong>{inviteDetails.orgName}</strong>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {inviteDetails.status !== "pending" && (
                    <Alert>
                      <AlertDescription>
                        This invitation has been{" "}
                        <strong>{inviteDetails.status}</strong>.
                      </AlertDescription>
                    </Alert>
                  )}

                  {inviteDetails.isExpired && (
                    <Alert variant="destructive">
                      <Clock className="h-4 w-4" />
                      <AlertTitle>Invitation Expired</AlertTitle>
                      <AlertDescription>
                        This invitation expired on{" "}
                        {new Date(inviteDetails.expiresAt).toLocaleDateString()}.
                        Please request a new invitation.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Invitation Details
                    </h3>

                    <div className="grid gap-3 md:gap-4 p-4 bg-muted/50 rounded-lg border">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          Invited Email
                        </div>
                        <span className="font-medium text-sm break-all">
                          {inviteDetails.email}
                        </span>
                      </div>

                      <Separator />

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Shield className="h-4 w-4" />
                          Your Role
                        </div>
                        <Badge
                          variant={getRoleBadgeVariant(inviteDetails.role)}
                          className="capitalize text-sm w-fit"
                        >
                          {inviteDetails.role}
                        </Badge>
                      </div>

                      <Separator />

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          Expires On
                        </div>
                        <span className="text-sm">
                          {new Date(inviteDetails.expiresAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }
                          )}
                        </span>
                      </div>

                      <Separator />

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                        <span className="text-sm text-muted-foreground">
                          Invited By
                        </span>
                        <span className="text-sm font-medium break-all">
                          {inviteDetails.invitedBy}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Organization Overview
                    </h3>

                    <div className="grid grid-cols-3 gap-3 md:gap-4">
                      <Card>
                        <CardContent className="pt-4 md:pt-6 pb-3 md:pb-4 text-center">
                          <Users className="h-5 w-5 md:h-6 md:w-6 mx-auto mb-2 text-muted-foreground" />
                          <div className="text-xl md:text-2xl font-bold">
                            {inviteDetails.orgStats.members}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Members
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-4 md:pt-6 pb-3 md:pb-4 text-center">
                          <Package className="h-5 w-5 md:h-6 md:w-6 mx-auto mb-2 text-muted-foreground" />
                          <div className="text-xl md:text-2xl font-bold">
                            {inviteDetails.orgStats.products}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Products
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-4 md:pt-6 pb-3 md:pb-4 text-center">
                          <Warehouse className="h-5 w-5 md:h-6 md:w-6 mx-auto mb-2 text-muted-foreground" />
                          <div className="text-xl md:text-2xl font-bold">
                            {inviteDetails.orgStats.warehouses}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Warehouses
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                      Organization created on{" "}
                      {new Date(inviteDetails.orgCreatedAt).toLocaleDateString()}
                    </p>
                  </div>

                  {canAccept && (
                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertTitle>About the {inviteDetails.role} role</AlertTitle>
                      <AlertDescription className="mt-2">
                        {inviteDetails.role === "admin" &&
                          "Full access to all features, settings, and member management."}
                        {inviteDetails.role === "manager" &&
                          "Can manage inventory, orders, and invite team members."}
                        {inviteDetails.role === "employee" &&
                          "Can view and update inventory, create orders."}
                        {inviteDetails.role === "viewer" &&
                          "Read-only access to view organization data."}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>

                <CardFooter className="flex flex-col sm:flex-row gap-3 pt-6">
                  {canAccept ? (
                    <>
                      <Button
                        className="w-full sm:flex-1 gap-2"
                        size="lg"
                        onClick={handleAccept}
                        disabled={isAccepting || isDeclining}
                      >
                        {isAccepting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Accepting...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Accept Invitation
                            <ArrowRight className="h-4 w-4 ml-auto" />
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={handleDecline}
                        disabled={isAccepting || isDeclining}
                        className="w-full sm:w-auto px-8"
                      >
                        {isDeclining ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Declining...
                          </>
                        ) : (
                          "Decline"
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => router.push("/organization")}
                    >
                      Go to Organizations
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>
          </div>
  );
}
