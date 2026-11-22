import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  FileCheck2,
  FilePlus2,
  FileSearch,
  Lock,
  QrCode,
  Search,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import useLdrsUser from '@/hooks/useLdrsUser';
import Brand from '@/components/layout/Brand';
import ThemeToggle from '@/theme/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function LandingPage() {
  const { user } = useLdrsUser();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Brand to="/" />
          
          <nav className="hidden items-center gap-6 md:flex text-sm font-medium text-muted-foreground">
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How It Works
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              Services
            </a>
            <Link to="/pickup-points" className="transition-colors hover:text-foreground">
              Stations
            </Link>
            <a href="#security" className="transition-colors hover:text-foreground">
              Security & Privacy
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <Button asChild>
                <Link to="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/login?mode=register">Get Started</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary-subtle/30 via-background to-background py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-sm mb-6">
              <span className="flex h-2 w-2 rounded-full bg-success" />
              National Document Recovery Network · Republic of Kenya
            </div>

            <h1 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-foreground">
              Recover Lost Identity Documents <span className="text-primary">Safely & Quickly</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
              Report lost National IDs, Passports, and Certificates. Search documents handed in at official police stations
              and chief&apos;s offices across all 47 counties — with rigorous privacy protection and verified collection.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild className="h-11 px-6 shadow-sm">
                <Link to="/report-lost">
                  <FilePlus2 className="mr-2 h-5 w-5" aria-hidden="true" />
                  Report a Lost Document
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild className="h-11 px-6">
                <Link to="/search">
                  <Search className="mr-2 h-5 w-5" aria-hidden="true" />
                  Search Found Register
                </Link>
              </Button>
            </div>

            {/* Quick trust metrics */}
            <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4 max-w-4xl mx-auto border-t border-border pt-10">
              <div className="p-3 text-center">
                <p className="text-2xl font-bold text-foreground">47 Counties</p>
                <p className="text-xs text-muted-foreground mt-0.5">Nationwide Coverage</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-2xl font-bold text-foreground">Police &amp; Chief</p>
                <p className="text-xs text-muted-foreground mt-0.5">Verified Stations</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-2xl font-bold text-foreground">Masked Privacy</p>
                <p className="text-xs text-muted-foreground mt-0.5">Zero Identity Leakage</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-2xl font-bold text-foreground">SHA-256</p>
                <p className="text-xs text-muted-foreground mt-0.5">Tamper-Proof Receipts</p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-16 sm:py-24 border-b border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto">
              <Badge tone="primary" className="mb-2">Three Simple Steps</Badge>
              <h2 className="text-2xl font-bold sm:text-3xl">How Document Recovery Works</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Built to protect citizens against identity theft while making the collection process seamless and secure.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              <Card className="relative overflow-hidden border-border bg-card">
                <CardContent className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold mb-4">
                    1
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Report or Hand In</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Finders and station officers record documents handed in. Owners report lost documents in seconds with location details.
                  </p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-border bg-card">
                <CardContent className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold mb-4">
                    2
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Confidential Matching</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Our smart matching engine alerts owners without ever exposing their full ID number or photo to the public.
                  </p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-border bg-card">
                <CardContent className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold mb-4">
                    3
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Verified Collection</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Visit the pickup station, present your single-use collection code, verify physical identity, and receive a signed QR receipt.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Public Services Grid */}
        <section id="features" className="py-16 sm:py-24 border-b border-border">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto">
              <Badge tone="accent" className="mb-2">Citizen Services</Badge>
              <h2 className="text-2xl font-bold sm:text-3xl">Everything You Need in One Place</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                LDRS bridges the gap between citizens who find lost documents and the owners searching for them.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="border-border bg-card transition-shadow hover:shadow-md">
                <CardContent className="p-6 space-y-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-foreground">
                    <FileSearch className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold">Masked Document Search</h3>
                  <p className="text-sm text-muted-foreground">
                    Search by document type and number. Results are masked (e.g. 28****13) to protect personal privacy while letting you confirm a match.
                  </p>
                  <Button variant="link" className="px-0 text-primary font-medium" asChild>
                    <Link to="/search">
                      Search Register <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border bg-card transition-shadow hover:shadow-md">
                <CardContent className="p-6 space-y-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-foreground">
                    <Building2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold">Official Pickup Stations</h3>
                  <p className="text-sm text-muted-foreground">
                    Find verified police stations and chief&apos;s offices, complete with phone contacts, operating hours, and exact street landmarks.
                  </p>
                  <Button variant="link" className="px-0 text-primary font-medium" asChild>
                    <Link to="/pickup-points">
                      View Stations <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border bg-card transition-shadow hover:shadow-md">
                <CardContent className="p-6 space-y-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-foreground">
                    <QrCode className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold">Receipt Authenticity Verifier</h3>
                  <p className="text-sm text-muted-foreground">
                    Verify digital handover receipts in real-time. Scan the QR code on any released document receipt to confirm genuine station handover.
                  </p>
                  <Button variant="link" className="px-0 text-primary font-medium" asChild>
                    <Link to="/login">
                      Learn More <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border bg-card transition-shadow hover:shadow-md">
                <CardContent className="p-6 space-y-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-foreground">
                    <FileCheck2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold">Ownership Claim Workflow</h3>
                  <p className="text-sm text-muted-foreground">
                    Spotted your lost item? Submit a claim with proof details. Station officers review and confirm claims before release.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border bg-card transition-shadow hover:shadow-md">
                <CardContent className="p-6 space-y-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-foreground">
                    <Smartphone className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold">SMS Alert Notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    Get notified immediately when your document is handed in. Collection codes arrive securely on your verified phone.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border bg-card transition-shadow hover:shadow-md">
                <CardContent className="p-6 space-y-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-foreground">
                    <Lock className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold">Encrypted Document Photos</h3>
                  <p className="text-sm text-muted-foreground">
                    All document images are stored AES-256 encrypted. Only authorized station officers can inspect the image for verification.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Security & Governance */}
        <section id="security" className="py-16 sm:py-24 bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-2 items-center">
              <div>
                <Badge tone="success" className="mb-2">Data Protection Act, 2019</Badge>
                <h2 className="text-2xl font-bold sm:text-3xl text-foreground">
                  Security Designed from Day One
                </h2>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                  Lost identity documents carry high risk of fraud and extortion. LDRS eliminates predatory third parties
                  by partnering directly with administrative stations and enforcing strict privacy safeguards.
                </p>

                <ul className="mt-6 space-y-3.5 text-sm">
                  <li className="flex items-start gap-3">
                    <BadgeCheck className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span><strong>No Public Photos:</strong> Document images are never exposed online or indexed by search engines.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <BadgeCheck className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span><strong>6-Digit OTP Release:</strong> Releasing a document requires a one-time code only given to the verified owner.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <BadgeCheck className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span><strong>Append-Only Audit Trail:</strong> Every inspection, claim, and release is permanently recorded in a SHA-256 hash chain.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <BadgeCheck className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span><strong>Citizen Data Rights:</strong> Owners can download a complete copy of their data or request removal under the ODPC guidelines.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                    <ShieldCheck className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-foreground">Official Station Network</h3>
                    <p className="text-xs text-muted-foreground">Certified custody and release protocol</p>
                  </div>
                </div>

                <div className="mt-5 space-y-4 text-xs text-muted-foreground">
                  <p>
                    All physical identity documents handed into LDRS are deposited at registered Police Stations or Chief&apos;s Offices.
                    Under Kenyan law, identity documents remain government property and must be handled with appropriate legal chain of custody.
                  </p>
                  <div className="rounded-lg bg-muted p-4 space-y-2 border border-border">
                    <p className="font-medium text-foreground">Need Immediate Assistance?</p>
                    <p>Visit your nearest police station to report loss of sensitive identity documents or report online here.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-16 sm:py-20 border-t border-border bg-card">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl text-foreground">
              Ready to Report or Search?
            </h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">
              Join thousands of citizens returning and recovering identity documents safely. Create your account today.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild className="h-11 px-8">
                <Link to="/login?mode=register">Create an Account</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild className="h-11 px-8">
                <Link to="/pickup-points">Find Stations</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-10 text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">LDRS</span>
            <span>— Lost Documents Recovery System (v6)</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/search" className="hover:underline">Search Register</Link>
            <Link to="/pickup-points" className="hover:underline">Pickup Stations</Link>
            <Link to="/login" className="hover:underline">Officer / Admin Portal</Link>
            <span>Compliant with Kenya DPA 2019</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
