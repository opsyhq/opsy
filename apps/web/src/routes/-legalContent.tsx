import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

const CURRENT_TERMS_VERSION = "2026-04-01" as const
const CURRENT_PRIVACY_VERSION = "2026-05-20" as const

const TERMS_PUBLIC_PATH = "/terms" as const
const PRIVACY_PUBLIC_PATH = "/privacy" as const

type LegalDocumentType = "terms" | "privacy"

type LegalDocumentMetadata = {
	type: LegalDocumentType
	title: string
	version: string
	effectiveDate: string
	publicPath: string
}

const LEGAL_DOCUMENTS: Record<LegalDocumentType, LegalDocumentMetadata> = {
	terms: {
		type: "terms",
		title: "Terms of Service",
		version: CURRENT_TERMS_VERSION,
		effectiveDate: "2026-04-01",
		publicPath: TERMS_PUBLIC_PATH,
	},
	privacy: {
		type: "privacy",
		title: "Privacy Policy",
		version: CURRENT_PRIVACY_VERSION,
		effectiveDate: "2026-05-20",
		publicPath: PRIVACY_PUBLIC_PATH,
	},
} as const

type LegalSection = {
	title: string
	body?: ReactNode
	items?: ReactNode[]
}

function formatEffectiveDate(date: string): string {
	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	}).format(new Date(`${date}T00:00:00Z`))
}

function LegalPageChrome({
	title,
	description,
	version,
	effectiveDate,
	children,
}: {
	title: string
	description: string
	version: string
	effectiveDate: string
	children: ReactNode
}) {
	return (
		<div className="mx-auto max-w-4xl px-4 py-16 md:px-6 md:py-24">
			<Link
				to="/"
				className="mb-8 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				&larr; Back to Home
			</Link>

			<div className="space-y-3">
				<h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
				<p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
				<p className="text-sm text-muted-foreground">
					Version {version} • Effective {formatEffectiveDate(effectiveDate)}
				</p>
			</div>

			<div className="prose prose-invert mt-12 max-w-none space-y-10">
				{children}
			</div>
		</div>
	)
}

function LegalSections({ sections }: { sections: LegalSection[] }) {
	return (
		<>
			{sections.map((section) => (
				<section key={section.title}>
					<h2 className="mb-4 text-xl font-semibold">{section.title}</h2>
					{section.body ? (
						<div className="space-y-4 text-muted-foreground">
							{section.body}
						</div>
					) : null}
					{section.items?.length ? (
						<ul className="ml-2 list-disc space-y-2 text-muted-foreground">
							{section.items.map((item) => (
								<li key={`${section.title}-${item}`}>{item}</li>
							))}
						</ul>
					) : null}
				</section>
			))}
		</>
	)
}

const termsSections: LegalSection[] = [
	{
		title: "1. Agreement Scope",
		body: (
			<>
				<p>
					These Terms of Service govern access to Opsy’s hosted software, APIs,
					CLI, MCP endpoints, previews, plans, automation features, agent
					workflows, and related support or professional services (collectively,
					the &quot;Service&quot;). Opsy, Inc. is a Delaware corporation with a
					mailing address at 1207 Delaware Avenue #3594, Wilmington, DE 19806.
				</p>
				<p>
					The Service is offered only for business, professional, commercial, or
					internal development and operations use. It is not intended for
					personal, family, or household consumer use. If you access or use the
					Service on behalf of an entity, that entity is the customer bound by
					this Agreement and you represent that you have authority to bind it.
					Otherwise, you are bound personally.
				</p>
			</>
		),
	},
	{
		title: "2. Acceptance and Order of Precedence",
		body: (
			<>
				<p>
					By creating an organization, accessing, or using the Service, Customer
					accepts this Agreement and the Privacy Policy. Customer purchase
					orders, portals, vendor paper, or similar terms do not modify or
					supersede this Agreement unless Opsy signs a separate written
					agreement expressly doing so.
				</p>
				<p className="rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-foreground">
					This Agreement includes mandatory binding individual arbitration and a
					class-action, representative-action, and jury-trial waiver.
				</p>
			</>
		),
	},
	{
		title: "3. Service Rights and Restrictions",
		body: (
			<>
				<p>
					Subject to this Agreement, Opsy grants Customer a limited,
					non-exclusive, non-transferable, revocable right to use the Service
					during the applicable subscription term. Opsy may modify, suspend,
					replace, or discontinue features, integrations, interfaces, models,
					limits, or dependencies at any time and does not commit to any
					roadmap, release, or backwards compatibility schedule.
				</p>
			</>
		),
		items: [
			"Customer may not resell, sublicense, benchmark for publication, reverse engineer, interfere with, or use the Service to develop a competing service except to the extent applicable law expressly forbids the restriction.",
			"Customer may not use the Service in violation of law, sanctions, export controls, third-party terms, security requirements, or Opsy usage limits.",
			"Opsy may reject or ignore any conflicting terms submitted through procurement portals, purchase orders, click-throughs, or similar customer systems.",
		],
	},
	{
		title: "4. Customer Responsibilities",
		body: (
			<>
				<p>
					Customer is solely responsible for its environment, credentials, and
					decisions.
				</p>
			</>
		),
		items: [
			"Customer is solely responsible for cloud accounts, providers, integrations, credentials, credential scope, key rotation, approvals, prompts, instructions, inputs, configurations, backups, disaster recovery, rollback planning, and operational decisions.",
			"Customer must independently review and approve any material, sensitive, or destructive action before execution and must maintain independent recovery capability sufficient for its environment.",
			"Customer is solely responsible for the results of customer-approved actions, customer-provided inputs, overbroad or insecure credentials, misconfiguration, rollback failure, and any malware, compromise, or misuse originating from Customer systems, users, agents, or content.",
			"Customer bears all cloud-provider charges, third-party fees, substitute service costs, restoration costs, remediation costs, and similar expenses arising from Customer environments or approved actions.",
		],
	},
	{
		title: "5. Automation and Preview Disclaimers",
		body: (
			<>
				<p>
					The Service may generate previews, plans, diffs, drift results,
					automated actions, or other generated outputs using heuristics,
					automation, dependency planning, or third-party provider responses.
					Those outputs may be incomplete, delayed, inaccurate, or wrong.
				</p>
			</>
		),
		items: [
			"Customer must independently evaluate outputs and confirm they are appropriate for Customer’s environment before relying on them.",
			"Opsy does not guarantee that destructive actions will be prevented, flagged, stopped, reversible, or capable of rollback.",
			"Opsy is not liable for decisions made, actions taken, or losses incurred based on previews, plans, diffs, drift analysis, or other generated or automated outputs.",
		],
	},
	{
		title: "6. Fees, Suspension, and Termination",
		body: (
			<>
				<p>
					Fees, billing mechanics, and plan limits are as described in the
					Service or ordering flow. Unless non-waivable law requires otherwise,
					fees are non-refundable. Opsy may suspend, throttle, limit, or
					terminate access immediately for nonpayment, misuse, fraud, security
					or abuse risk, credential abuse, suspected unauthorized access,
					sanctions or export risk, or if continued service may expose Opsy or
					others to harm.
				</p>
				<p>
					Opsy may terminate this Agreement or any account, organization, or
					workspace at any time on notice. Customer may stop using the Service
					at any time, but termination does not excuse accrued payment
					obligations.
				</p>
			</>
		),
	},
	{
		title: "7. Confidentiality",
		body: (
			<>
				<p>
					Each party may receive non-public information from the other. Customer
					Confidential Information includes non-public customer data,
					credentials, configurations, logs, resource metadata, architecture
					details, incident materials, and security information. Opsy
					Confidential Information includes non-public product, pricing,
					roadmap, benchmarking, security, and business information.
				</p>
			</>
		),
		items: [
			"The receiving party will use the disclosing party’s Confidential Information only to perform or receive the Service and will protect it using reasonable care.",
			"Confidentiality obligations do not apply to information that is or becomes public without breach, was already lawfully known, is lawfully received from a third party without duty, or is independently developed without use of the disclosing party’s Confidential Information.",
			"A receiving party may disclose Confidential Information to affiliates, personnel, contractors, advisors, providers, and authorities with a need to know, or as required by law or legal process.",
		],
	},
	{
		title: "8. Intellectual Property and Feedback",
		body: (
			<>
				<p>
					Opsy and its licensors retain all rights, title, and interest in the
					Service, underlying software, models, documentation, and related
					intellectual property. Customer retains its rights in Customer data
					and content, but grants Opsy and its providers a worldwide,
					non-exclusive right to host, process, transmit, copy, transform, and
					display Customer data as reasonably necessary to provide, secure,
					support, and improve the Service.
				</p>
				<p>Feedback may be used by Opsy without restriction or obligation.</p>
			</>
		),
	},
	{
		title: "9. Warranties Disclaimer",
		body: (
			<>
				<p className="text-foreground">
					To the maximum extent permitted by law, the Service is provided
					&quot;as is,&quot; &quot;as available,&quot; and with all faults. Opsy
					disclaims all express, implied, statutory, and other warranties,
					including warranties of merchantability, fitness for a particular
					purpose, title, non-infringement, uninterrupted availability,
					error-free operation, security, and accuracy or completeness of
					outputs, previews, plans, diffs, drift results, or other generated or
					automated outputs. Opsy does not warrant that destructive actions will
					be prevented, caught, or reversible.
				</p>
			</>
		),
	},
	{
		title: "10. Indemnification",
		body: (
			<>
				<p>
					Customer will defend, indemnify, and hold harmless Opsy and its
					affiliates, personnel, licensors, and service providers from claims,
					damages, liabilities, costs, and expenses arising out of or related to
					Customer data, Customer instructions, Customer use of the Service,
					cloud or infrastructure changes initiated or approved by Customer,
					privacy or data law violations caused by Customer data or use,
					sanctions or export violations, and claims by Customer end users,
					customers, personnel, or internal stakeholders.
				</p>
				<p>
					Opsy’s sole indemnity obligation is to defend and indemnify Customer
					against a third-party claim alleging that the paid Service, as
					provided by Opsy and used as authorized, directly infringes that third
					party’s U.S. intellectual property rights. Opsy may modify the
					Service, procure continued use rights, or terminate affected access
					and refund any prepaid, unused fees for the terminated portion. This
					is Customer’s exclusive remedy for such claims.
				</p>
			</>
		),
	},
	{
		title: "11. Liability Limitations",
		body: (
			<>
				<p className="text-foreground">
					To the maximum extent permitted by law, Opsy will not be liable under
					any theory, including contract, tort, negligence, strict liability,
					misrepresentation, breach of statutory duty, or otherwise, for any
					indirect, incidental, special, exemplary, punitive, or consequential
					damages, or for any loss of profits, revenue, business, goodwill,
					opportunity, data, infrastructure availability, service interruption,
					substitute services, restoration costs, or remediation costs.
				</p>
				<p className="text-foreground">
					Opsy is not liable for customer-approved destructive actions, customer
					misconfiguration, insecure or overbroad credentials, failure to
					maintain backups or recovery capability, third-party or cloud outages,
					API behavior, throttling, deletions, data loss, or malware or
					compromise originating from customer systems or content.
				</p>
				<p className="text-foreground">
					Opsy’s aggregate liability for all claims arising out of or relating
					to the Service or this Agreement will not exceed the fees paid or
					payable by Customer for the Service in the three months before the
					event giving rise to the claim. If Customer used the Service for free,
					Opsy’s aggregate liability will not exceed $10 or the amount Customer
					paid for the Service, if lower. The only exceptions are liabilities
					that cannot legally be excluded or limited.
				</p>
			</>
		),
	},
	{
		title: "12. Modifications to this Agreement",
		body: (
			<>
				<p>
					Opsy may update this Agreement from time to time by posting a revised
					version on the Service or by notifying Customer via email. Changes
					become effective ten (10) days after posting or notice. Continued use
					of the Service after that period constitutes acceptance of the updated
					terms. If Customer does not agree with a modification, Customer's sole
					remedy is to stop using the Service before the change takes effect.
				</p>
			</>
		),
	},
	{
		title: "13. Acceptable Use",
		body: (
			<>
				<p>
					Customer will not use the Service in any manner that could damage,
					disable, overburden, or impair Opsy's systems or interfere with any
					other party's use of the Service.
				</p>
			</>
		),
		items: [
			"Customer will not attempt to gain unauthorized access to any systems, accounts, or data not intended for Customer.",
			"Customer will not use the Service for cryptocurrency mining, load testing of third-party systems, distribution of malware, unsolicited communications, or any unlawful purpose.",
			"Customer will not circumvent or attempt to circumvent any usage limits, rate limits, or access controls.",
			"Opsy may suspend or terminate access immediately if Customer violates this section.",
		],
	},
	{
		title: "14. Force Majeure",
		body: (
			<>
				<p>
					Neither party will be liable for any delay or failure to perform
					obligations under this Agreement caused by events beyond its
					reasonable control, including acts of God, natural disasters,
					pandemics, epidemics, war, terrorism, riots, government actions, power
					or internet failures, labor strikes, or third-party service outages.
					The affected party will use reasonable efforts to mitigate the impact
					and resume performance as soon as practicable.
				</p>
			</>
		),
	},
	{
		title: "15. Dispute Resolution; Arbitration; Class Waiver",
		body: (
			<>
				<p>
					Any dispute, claim, or controversy arising out of or relating to this
					Agreement or the Service will be resolved by binding individual
					arbitration administered by the American Arbitration Association under
					its Commercial Arbitration Rules, to the maximum extent permitted by
					law. Arbitration will be conducted in English before a single
					arbitrator. The legal seat and place of arbitration is Wilmington,
					Delaware. Hearings will be remote by default unless the arbitrator
					requires otherwise.
				</p>
			</>
		),
		items: [
			"The parties waive any right to a jury trial and any right to participate in a class action, collective action, representative action, or private-attorney-general action.",
			"Either party may bring an individual claim in small claims court where eligible, and either party may seek injunctive or equitable relief in court for intellectual property misuse, credential abuse, unauthorized access, or confidentiality breaches.",
			"If the arbitration or class waiver provisions are found unenforceable for a particular claim, that claim will proceed exclusively in the state or federal courts located in Delaware, and the remainder of this Agreement will remain enforceable to the fullest extent permitted by law.",
		],
	},
	{
		title: "16. General Terms",
		items: [
			"This Agreement is governed by Delaware law, excluding its conflicts rules.",
			"This Agreement constitutes the entire agreement between the parties with respect to its subject matter and supersedes all prior or contemporaneous agreements, understandings, negotiations, and discussions, whether oral or written.",
			"Opsy’s failure to exercise or enforce any right or provision of this Agreement will not operate as a waiver of that right or provision. No waiver will be effective unless made in writing.",
			"Neither party may assign this Agreement without the other party’s consent, except that Opsy may assign it in connection with a merger, acquisition, financing, reorganization, or sale of assets.",
			"No third party is a beneficiary of this Agreement.",
			"If any provision is unenforceable, it will be enforced to the maximum extent permitted and the rest of the Agreement will remain in effect.",
			"Sections that by their nature should survive do survive, including provisions addressing fees, confidentiality, intellectual property, disclaimers, limitations, indemnities, disputes, and general terms.",
			"Questions may be sent to saba@opsy.sh.",
		],
	},
]

const privacySections: LegalSection[] = [
	{
		title: "1. Scope and Roles",
		body: (
			<>
				<p>
					This Privacy Policy describes how Opsy handles information relating to
					the Service. Depending on context, Opsy may act as an independent
					controller for account, billing, support, security, and product usage
					information, and as a processor or service provider for Customer data
					that Customer submits to or makes accessible through the Service.
				</p>
				<p>
					This Policy supports the Terms of Service and applies to business,
					professional, commercial, or internal development and operations use.
				</p>
			</>
		),
	},
	{
		title: "2. Categories of Information",
		items: [
			"Account, organization, and authentication data, including names, emails, org identifiers, session details, permissions, and profile metadata.",
			"Cloud integration and infrastructure metadata, including provider account identifiers, configuration metadata, inventory metadata, resource identifiers, state snapshots, diffs, drift findings, approvals, audit trails, and operation history.",
			"Credential and secret handling metadata, such as encrypted secrets, key labels, secret fingerprints, scopes, rotation timestamps, and validation status. Opsy does not publish raw secret material back to normal dashboard or API responses after submission.",
			"Billing, support, and security telemetry, including subscription records, invoices, payment processor references, support interactions, incident records, logs, IP addresses, device data, rate-limit signals, abuse markers, and diagnostic telemetry.",
		],
	},
	{
		title: "3. How We Use Information",
		items: [
			"To authenticate users, provision organizations, operate the Service, and maintain customer-selected integrations.",
			"To execute or facilitate customer-requested workflows, previews, reviews, applies, and operational history.",
			"To secure the Service, detect misuse, enforce terms and limits, investigate incidents, and protect Opsy, Customers, and third parties.",
			"To provide billing, support, communications, analytics, service improvements, and legal compliance.",
		],
	},
	{
		title: "4. Sharing and Disclosure",
		body: (
			<>
				<p>
					Opsy may disclose information to service providers, hosting and
					infrastructure partners, cloud or integration providers at Customer
					direction, professional advisors, corporate transaction
					counterparties, and authorities where reasonably necessary to provide
					the Service, secure the Service, comply with law, or protect rights
					and safety.
				</p>
				<p>
					Opsy does not sell Customer personal information for consumer
					advertising purposes.
				</p>
			</>
		),
	},
	{
		title: "5. Subprocessors, Transfers, and DPA",
		body: (
			<>
				<p>
					Opsy may use subprocessors and infrastructure providers in multiple
					jurisdictions. Opsy may transfer information internationally,
					including to the United States and other places where Opsy or its
					providers operate. Where required, Opsy will use transfer mechanisms
					Opsy determines are appropriate for the Services offered.
				</p>
				<p>
					Current subprocessors include PostHog Inc. (product analytics),
					alongside Opsy’s hosting, infrastructure, and integration providers. A
					data processing addendum is available on request for applicable
					customers. Subprocessor information may be provided on request or via
					a separate Opsy subprocessor page when made available.
				</p>
			</>
		),
	},
	{
		title: "6. Cookies and Similar Technologies",
		body: (
			<>
				<p>
					Opsy uses cookies and similar browser storage (such as localStorage)
					for authentication, preference persistence, and product analytics.
					Authentication and preference storage are strictly necessary to
					operate the Service. Analytics storage holds an opaque identifier used
					to measure product usage, including page views, feature interactions,
					approximate location derived from IP, and browser and device
					information, which helps Opsy understand how the Service is used and
					improve it.
				</p>
			</>
		),
	},
	{
		title: "7. Retention",
		items: [
			"Account, organization, and billing records are generally retained for the term of the relationship and for a reasonable period afterward for billing, compliance, dispute, tax, audit, and security purposes.",
			"Operational logs, audit records, diffs, snapshots, and support materials are retained according to Opsy’s operational needs, contractual commitments, legal requirements, and security practices, and may persist in backups for a limited period.",
			"Credentials and secrets are retained while configured by Customer and may remain in encrypted backups or archival systems for a limited period after deletion or rotation.",
		],
	},
	{
		title: "8. Security",
		body: (
			<>
				<p>
					Opsy uses administrative, technical, and physical safeguards designed
					for the Service. Security measures vary over time. No system is
					perfectly secure, and Opsy does not promise that unauthorized access,
					loss, or alteration will never occur.
				</p>
			</>
		),
	},
	{
		title: "9. Rights and Requests",
		body: (
			<>
				<p>
					Depending on applicable law and Opsy’s role, individuals may request
					access, correction, deletion, portability, restriction, or objection
					by contacting saba@opsy.sh. Opsy may need to verify identity, route
					the request through the relevant Customer, or decline a request where
					law allows.
				</p>
				<p>
					When Opsy acts as a processor or service provider for Customer data,
					Customer is generally responsible for handling end-user requests.
				</p>
			</>
		),
	},
	{
		title: "10. Changes and Contact",
		body: (
			<>
				<p>
					Opsy may update this Policy from time to time by posting an updated
					version with a revised effective date. Questions, rights requests, and
					DPA requests may be sent to saba@opsy.sh.
				</p>
			</>
		),
	},
]

export function TermsDocument() {
	const document = LEGAL_DOCUMENTS.terms

	return (
		<LegalPageChrome
			title={document.title}
			description="Please read these terms carefully before using Opsy."
			version={document.version}
			effectiveDate={document.effectiveDate}
		>
			<LegalSections sections={termsSections} />
		</LegalPageChrome>
	)
}

export function PrivacyDocument() {
	const document = LEGAL_DOCUMENTS.privacy

	return (
		<LegalPageChrome
			title={document.title}
			description="Opsy’s privacy notice explains the categories of information handled through the service and how they support the underlying business service."
			version={document.version}
			effectiveDate={document.effectiveDate}
		>
			<LegalSections sections={privacySections} />
		</LegalPageChrome>
	)
}
