## Annotation use cases, placement and overlapping membership

Research supplied by the maintainer on 8 October during the
[alpha contract interview](2026-10-06-01-rnd0000-note-alpha-contract-interview.md).
This is a qualitative survey and design input, not a frequency estimate or
authorization to replace the compound model. No implementation round closes
and no existing feature deferral changes through this note.

### Scope and evidence

The survey concerns explanatory graphical additions to a network figure:
enclosures, explanatory text, leaders, legends, backgrounds and inset links.
It excludes ordinary node labels, biological annotations stored in tables and
the nodes/edges representing the network itself.

The maintainer supplied the figure examples and their interpretation. A focused
source check verified the Michaelis methods/Figure 4 caption, eXamine's paper
text, the author-hosted enrichment-map protocol, the official Legend Creator
tutorial and the desktop annotation manual. This was not an independent visual
inspection of every cited figure. The AutoAnnotate PMC page encountered an
access challenge; the protocol independently supports the described automatic
enclosure behavior. Cerebral's supplied figure interpretation and numbering
remain maintainer-supplied; its publisher article could not be retrieved here.

### Main finding and classification

The strongest recurring pattern in the supplied examples is an enclosing shape
plus a short label explaining a group of nodes. Other purposes include selective
emphasis, overlapping set membership, visual-encoding legends, overview/detail
correspondence and biological/spatial context. This is a synthesis of the sample,
not a numerical ranking of all Cytoscape publications.

Classify purpose first and graphical primitive second:

| Purpose | Typical primitives | Model/placement implications |
| --- | --- | --- |
| Group and summarize | Enclosure plus short text | Member references, bounds following, generated summaries |
| Highlight a finding | Outline around a node or selected subset | Partial membership, independent selection/appearance |
| Show set membership | Overlapping contours or enclosing regions | Many-to-many membership, contour geometry, set identity |
| Explain visual encoding | Swatches, gradients, symbols, lines and text | Composite layout, links to mapping metadata |
| Link overview and detail | Boxes, ellipses, panel labels and connectors | Region anchors, references to views or insets |
| Provide biological context | Images, compartment labels and separator lines | Coordinate frames, region constraints and placement rules |

A circle can be a graph node, a legend symbol, an individual highlight or a
group enclosure. An arrow can be a graph relationship or an explanatory leader.
The shape alone does not establish graph semantics or native implementation.

### Supplied concrete examples

| Example | Reported use | Source |
| --- | --- | --- |
| Michaelis et al. (2023), Figure 4 | Cluster circles, cellular background, labels, legend and connectors to enlarged subnetworks | [Nature](https://www.nature.com/articles/s41586-023-06739-5) |
| Reimand et al. (2019), Figures 10/13 and protocol | Short functional summaries, publication-ready map and legend components | [Author-hosted protocol](https://baderlab.github.io/EnrichmentMap_Protocol/annotate.html), [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6607905/) |
| Kucera et al. (2016), AutoAnnotate | Cluster identification, enclosing shapes and semantic summaries | [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5082607/) |
| Zeng et al. (2017), Figure 5 | An outline singles out an MCODE dense region, without partitioning all remaining nodes | [Frontiers paper](https://www.frontiersin.org/journals/microbiology/articles/10.3389/fmicb.2017.01929/pdf) |
| Singhal et al. (2020), Figure 3 | Rectangles and panel references connect selected hierarchy/community regions to detail panels | [PLOS paper](https://journals.plos.org/ploscompbiol/article/file?id=10.1371%2Fjournal.pcbi.1008239&type=printable) |
| Dinkla et al. (2014), eXamine, Figure 8 | Irregular contours display pathway/functional sets with overlapping membership | [Paper](https://arxiv.org/pdf/1407.2101) |
| Barsky et al. (2007), Cerebral | Horizontal compartment boundaries, location labels and functional grouping regions | [Publisher DOI](https://doi.org/10.1093/bioinformatics/btm057) |
| Merico et al. (2010), Figures 2/3/4 | Functional leaders, circled/labeled groups and overview-to-magnification connectors | [PLOS paper](https://journals.plos.org/plosone/article/file?id=10.1371%2Fjournal.pone.0013984&type=printable) |
| Mannala et al. (2017), Figure 4 | Outline styles distinguish entity/validation categories while color encodes expression direction | [Frontiers paper](https://www.frontiersin.org/journals/microbiology/articles/10.3389/fmicb.2017.02463/pdf) |
| Official Legend Creator tutorial | Legends built from editable, groupable annotation components | [Cytoscape tutorial](https://cytoscape.org/cytoscape-tutorials/protocols/legend-creator/) |
| Official advanced annotation tutorial | Native Mutation text, T-bar leader, group boundary and title | [Cytoscape tutorial](https://cytoscape.org/cytoscape-tutorials/protocols/advanced-annotations/) |

Interpretive cautions from the supplied survey:

- A group boundary and its label perform different jobs: membership/extent
  versus biological meaning.
- A selected result need not define a complete partition of the network.
- Overlapping pathway/function sets differ from disjoint detected clusters.
- Outline style and color can encode independent variables. Expression
  validation does not establish every predicted direct regulatory interaction.
- A legend explains visual encoding; a cluster label explains a group.
- Label size based on member count can indicate pathway popularity rather than
  experimental importance.
- Published appearance does not prove which native object or post-export tool
  produced it. Preserve that distinction in fixtures and compatibility claims.
- The sample emphasizes biological networks/enrichment maps. No systematic
  X.com-feed review or annotation-frequency claim was supplied.

### Findings checked against primary material

**Automatic enclosure following.** The author-hosted protocol says AutoAnnotate
creates cluster circles and word-based summaries; individual node movement
resizes circles and cluster movement redraws them. Its example's legend was
added manually. This supports member-bound geometry and generated content,
without proving they must be compound parents.
[Source](https://baderlab.github.io/EnrichmentMap_Protocol/annotate.html)

**Layout and graphical context interact.** Michaelis describes localization-based
group arrangement using Boundary layout, expansion and manual adjustment,
AutoAnnotate naming, and a SwissBioPics-derived background. This supports region
constraints alongside authored explanatory graphics.
[Source](https://www.nature.com/articles/s41586-023-06739-5)

**Set membership can influence layout.** eXamine retains graph topology while
adding a set system and jointly lays out links and contours. It targets small
modules with many annotation sets, potentially more sets than interactions.
Do not assume annotation populations are always a few independent objects.
[Source](https://arxiv.org/pdf/1407.2101)

**Composite annotations matter.** Legend Creator documents individual legend
items, grouping/ungrouping and placement outside network bounds. The desktop
manual documents separate annotation layers and native Shape, Text, Bounded
Text, Arrow and Image types. These are evidence for use cases, not requirements
to reproduce every desktop mechanism in alpha.
[Tutorial](https://cytoscape.org/cytoscape-tutorials/protocols/legend-creator/),
[manual](https://manual.cytoscape.org/en/stable/Annotations.html)

### Design implications to interview, not approved contracts

#### Membership, containment and drawing

The maintainer proposed specifying meta-/hyper-node membership on the owning
object as an array of children, permitting arbitrary overlaps. Treat this as a
candidate design to evaluate; the field name and topology semantics are open.

Changing where membership is declared and allowing multiple memberships are
separate decisions. A parent-owned children array can still encode a strict
tree if each child has one parent. Overlap requires a many-to-many relation,
regardless of whether the field is called children or members.

Separate the questions:

- **Compound containment:** movement inheritance, parent-derived bounds,
  ancestor/descendant operations, structural depth and miniature/collapse
  behavior.
- **Set membership:** one node belongs to several pathways, findings or groups;
  each set has its own identity, metadata and visible region.
- **Hypergraph topology:** whether the set itself represents a relationship
  and participates in algorithms; a set enclosure does not automatically imply
  a hyperedge or an additional pairwise connection.

One candidate is to preserve compound containment and add a separate membership
relation. Another is to generalize the element/group model. The latter needs
explicit rules for moving a multiply-owned child, collapse, depth, cycles,
layouts and algorithms. Do not quietly reinterpret existing parent()/children()
contracts or maintain two independently writable membership sources of truth.

Current v4 hulls derive membership from the compound tree; overlapping membership
is explicitly deferred outside 4.0. This research reopens discussion, not that
release commitment. See [round 82](2026-08-14-13-rnd0082-landed-compound-hull-shapes.md)
and [feature direction](../../docs/feature-direction.md).

#### Anchoring and placement

Interview optional anchoring across all annotation kinds, not only line ends:

- Position-following relative to an element, member-set bounds or edge path.
- Bounds-following for enclosures, with padding and separate explanatory text.
- Independent source/target anchors for leaders and overview/detail connectors.
- Free annotations and viewport-relative legends or context graphics.
- Fixed versus dynamically maintained target sets, label inclusion, empty/deleted
  targets, drag behavior, coordinate units and dependency-cycle prevention.

Horizontal compartment separators expose two distinct uses: a line derived from
already arranged bands, or a boundary constraining placement before/during a
layout. A compound can model a containing region but does not by itself specify
an open separator, ordering of compartments or arbitrary overlapping sets.

Evaluate three layout integration levels independently: resolve anchors after a
graph layout; arrange annotation footprints in a separate placement pass; allow
an aware graph layout to use annotation/region constraints. Prevent bounds
feedback, for example an enclosure anchoring to bounds that include itself.

#### Data and shared collection behavior

The prior approved starting scope had no annotation.data() and only constants/
state conditionals in styling. The maintainer has now asked to reconsider data
use cases. Possible inputs include semantic categories, provenance, analysis
results, member references, summary inputs, placement priority and legend
mapping references. Data storage, style mapping support and graph membership
are separate decisions; none is authorized merely by listing these uses.

The maintainer explicitly requires code reuse if annotation APIs substantially
overlap collections. Inventory shared lifecycle/events, selection, locks,
styles/bypasses/transitions, bounds and editing operations. Use shared
implementations with storage/geometry adapters where suitable, while making
graph-specific capabilities explicit. Public collection membership, generic ID
lookup and inheritance/composition strategy remain open; no percentage of
overlap has been measured.

#### Evidence and review fixtures

Plan repo-owned synthetic fixtures informed by the survey, without depending on
the Cytoscape Web implementation or copying unreviewed publication images:

1. Cluster enclosure/summary that follows member movement and resizing.
2. Two partially overlapping sets sharing one node without reparenting it.
3. Compartment bands with derived separator lines and optional layout constraints.
4. Composite legend outside graph bounds with selection, movement and export.
5. Overview-region-to-detail connector, including removed/moved targets.
6. Context background with nested annotations and readable foreground labels.

Benchmark membership count, overlap, anchor fan-out, node/annotation population,
incremental updates, allocations and layout/placement costs. Include modules
with many sets; do not choose storage or performance thresholds solely from
the earlier assumption of tens of annotations. Algorithmic set-contour layout
and ordinary hull drawing require separate fidelity and cost checks.

### Next interview decisions

Preserve compound containment alongside overlapping membership, as subsequently
required by the maintainer. Then settle the owner/reference model and terminology,
anchoring scope and timing, annotation data, public collection membership and code reuse,
placement/layout integration, and persistence. Ask one decision at a time.

Earlier explicit decisions remain in force unless superseded by an answer.
Research recommendations do not mark these capabilities implemented or expand
the alpha gate automatically.

### Subsequent interview: compounds and numeric membership

The maintainer requires support for compound nodes as a distinct, established
model and explicitly allows a node to have one compound parent plus membership
in multiple overlapping groups. Declaration fields (`parent`, `parents`,
`children`, `members`), object-kind inference/conversion, and the public name
(group, set, bag, multiset) remain open. Existing compound traversal and
containment semantics must not silently acquire multiple parents.

Numeric membership values are under consideration, not approved. Ordinary
multisets use nonnegative integer multiplicities; signed/hybrid and real-valued
generalizations also exist. Arbitrary metadata on the whole object or on each
membership is a separate design question. The technical named-set construction
relates objects to names through a relation; it is broader than a collection with
a title. [Burgin, Sections 2 and 3.2](https://arxiv.org/pdf/math/0403186).

### Literature check: negative and zero multiplicities

Focused research requested on 8 October. These are concrete primary-source uses,
not a prevalence survey. The arithmetic illustrations below are constructed
examples of the cited models, not reproduced experimental cases.

| Use | Negative values | Zero values | Primary source |
| --- | --- | --- | --- |
| Incremental data processing | Removal/retraction of records; differences between versions | No record contribution at that version; sparse traces retain only nonzero counts | [McSherry et al., Differential Dataflow (2013), Sections 3 and 4.3](https://www.microsoft.com/en-us/research/wp-content/uploads/2013/01/differentialdataflow.pdf) |
| Chemical reaction hypergraphs | Net consumption of a species, with positive values for net production | No net change, which can arise from nonparticipation or cancellation | [Bailey, Gull and Oliveira, Section 2](https://arxiv.org/pdf/0902.0847) |
| Symbolic domain decomposition | Regions to subtract/cancel when manipulating piecewise functions and symbolic block matrices | No domain membership; cancelled terms need not be evaluated | [Carette et al., Symbolic Domain Decomposition (2010), Sections 2.2, 3.4 and 6](https://arxiv.org/pdf/1004.5549) |
| Verification of heap references | A permission to remove one predecessor occurrence, combined algebraically with positive occurrences | Empty predecessor knowledge has a distinct logical meaning under the paper's permission conditions | [Moine, Chargueraud and Pottier, Will It Fit?, Section 5.6](https://cs.nyu.edu/~am15509/publications/moine-chargueraud-pottier-24.pdf) |
| Petri-net equivalence proofs | Signed differences/linear combinations of markings, while ordinary reachable markings remain nonnegative | Zero multiplicity means absent from the signed multiset | [van Glabbeek et al., On Characterising Distributability (2013), Definition 2.1 and Section 2](https://arxiv.org/pdf/1309.3883) |
| Generalized combinatorics | Extend identities involving binomial coefficients and symmetric functions to negative parameters | Empty hybrid set has all multiplicities zero | [Loeb, Sets with a Negative Number of Elements](https://faculty.uml.edu/jpropp/negative.pdf) |

**Concrete incremental example.** A collection holding A twice can receive a
delta A:-1 and then contain A once. A delta A:+1 followed by A:-1 cancels to
zero. A negative delta is not itself a claim that the resulting ordinary
collection has negative physical contents. Differential Dataflow also uses
signed collections internally; distinguish those from the app's current group.

**Concrete biochemical example.** For the illustrative reaction 2A + B -> C,
the product-minus-reactant multiset is A:-2, B:-1, C:+1. The cited chemical
network paper uses exactly this product-minus-reactant construction, maps signs
to directed hyperedge incidence and magnitudes to weights, and analyzes a MAP
kinase cascade. Chemical complexes themselves retain nonnegative molecularities.
This is evidence for signed hyperedge participation, not proof that a spatial
enclosure needs signed containment.

**Zero loses participation information.** In A + E -> B + E, E's net coefficient
is zero despite appearing on both sides. This follows from the cited
product-minus-reactant definition; the example is our illustration. Likewise,
net zero across a pathway can hide intermediate participation. Preserve separate
reactant/product membership or metadata if the app needs to display those roles.
Do not infer absence from a net-change coefficient outside its chosen model.

**Concrete geometric example.** Symbolic Domain Decomposition represents [0,1]
as [-1,2] minus [-1,0) minus (1,2]. Outside [0,1], contributions cancel to zero.
Its support is the points with nonzero multiplicity; the paper applies this to
symbolic matrix addition and spline manipulation. This demonstrates useful
negative region contributions, but does not establish a node-enclosure carving
algorithm or a suitable default for v4.

**Theoretical versus empirical use.** P Systems with Hybrid Sets explores a
cell-inspired computational model with negative object multiplicities. Its
authors explicitly do not claim a real-cell model; electrical charge is offered
as a possible interpretation. Do not cite it as experimental biological evidence.
[Belingheri, Porreca and Zandron](https://aeporreca.org/papers/p-systems-with-hybrid-sets.pdf).

### Implications from the numeric-membership research, not decisions

- Negative values have concrete uses in update algebra, reaction incidence,
  symbolic geometry and verification. They are often cancellation, direction or
  permission information rather than literal negative copies of a physical item.
- In the signed/hybrid definitions inspected, zero is absent from the support;
  negative values are present. Zero is not a special visible member category.
  An app needing explicit zero-valued associations must retain that information
  separately or choose a different weighted-membership contract.
- A signed total can be zero without the multiset being empty: A:+1, B:-1 has
  two support members. The Petri-net paper defines cardinality by the sum of
  absolute multiplicities. Do not equate signed total, absolute total and distinct
  member count, or imply one convention is universal across the literature.
- Drawing bounds around all nonzero members is consistent with support-based
  enumeration, but is our proposed visualization policy. Negative values do not
  inherently require holes, exclusion from the hull, negative sizes or reversed
  movement. Such behavior requires a separately specified visualization.
- Whether numeric values are restricted to integers or allow finite fractions,
  whether zero entries are normalized away, and which operations belong in core
  remain open. No numeric membership API or alpha scope expansion is authorized.

### Declaration, terminology and API alternatives discussed

These alternatives were discussed during the interview. They remain design
input unless explicitly approved below; preserve compounds and permit a single
compound parent alongside multiple overlapping memberships.

| Declaration | Benefits | Costs/questions |
| --- | --- | --- |
| Child-owned `parent` | Compatibility with compounds; simple single-parent tree | Cannot express multiple overlapping memberships alone |
| Child-owned `parents` | Lists multiple owners on the member | Risks confusing memberships with structural ancestors; existing `parents()` traverses all compound ancestors |
| Owner-owned `children` | Convenient creation/import of a group and its contents | Name suggests compound containment; overlaps still need an explicit many-to-many model |
| Owner-owned `members` | Separates overlapping membership from compound containment | Needs reverse lookup, validation and rules for removed or unresolved references |
| Accept multiple declaration forms | Convenient adapters and compatibility | Must normalize into one canonical relation and define contradictory declarations; never maintain independent mutable copies |

Declaration location does not determine multiplicity. A `children` array can
still describe a strict tree; arbitrary overlaps require a many-to-many
relation. Import convenience does not require exposing every declaration as an
independently writable public API.

**Kinds and inference.** Discussed a compound-node plus set/group/multiset-node
model. Presence of `members`, including an empty array, could infer the latter;
compounds could retain inference from child `parent` references. Explicit kind
declaration is another option. Whether an object can be both kinds, be nested
inside a compound, or convert between kinds remains undecided. A proposed ban
on compound/group conversion must not accidentally ban the existing ordinary
node becoming or ceasing to be a compound parent. The comparison with directed
and undirected edges motivates flexibility, but settles no inference rule.

**Naming.** `set` overlaps with the public collection's Set-like behavior;
`group` aligns with desktop terminology but must not overload existing
`group()` meanings (nodes/edges). `bag` and `multiset` communicate multiplicity,
which is useful for stoichiometry but creates expectations about arithmetic.
All sets already have cardinality; bags add repeated occurrences. `members()`
and `isSet()`/`isGroup()` were illustrative names, not agreed API spellings.

**Member identity and drawing.** A multiplicity of two need not create two
independent drawn copies of the same graph node. Discussed returning a distinct
member collection with numeric values queried separately. Repeated entries,
value defaults, update semantics and aggregation still need a contract. Drawing
the same conceptual set more than once may require separating set identity
from its visual representations, with an optional convenience combined object.

**Enclosures versus graph objects.** A membership object and an enclosure can
share member tracking, bounds and geometry. They do not thereby share topology,
collapse, movement inheritance or algorithm participation. Compounds retain
their tree semantics. Overlapping ownership makes automatic move/collapse
policies ambiguous, so shared implementation does not imply shared behavior.
The maintainer requires code reuse where annotation and collection APIs overlap;
the suggested 90% similarity has not been measured.

**Metadata.** A whole-object `multiset.data()` could hold a label, provenance or
an ID-keyed map of per-member roles. For example, an app could associate A with
`catalyst` and B with `substrate`, independently of numeric multiplicities.
This app-managed map must follow membership changes and removals. A dedicated
per-membership data API would reduce that bookkeeping but expands the core
surface. Whole-object data, per-membership data and numeric membership values
are separate choices, and no exact data API is approved here.

### Provisional multiset direction (11 October)

The maintainer provisionally accepts the recommendation from the literature
review, explicitly requiring more review:

- Enumerate distinct members with nonzero numeric values.
- Preserve sign and magnitude for app interpretation and explicit visual
  mappings; no implicit negative geometry, reversed movement or repeated copies.
- Preserve participation separately when net cancellation would lose it, for
  example separate reaction-side membership or app metadata for a catalyst.
- Distinguish distinct member count, signed total and absolute total.

This is a provisional direction, not final sign-off on a public API, naming,
numeric validation, mathematical operations, storage, rendering or release
timing. Negative values are part of the candidate model; the exact numeric
domain (integers/fractions, finiteness and precision) needs review. Zero is
outside the enumerated support; retention/normalization of explicitly supplied
zero entries and their metadata still needs a decision. Numeric-only values
with app-managed arbitrary data are the candidate approach, not a completed
data contract.

Review against reaction/hyperedge and overlapping-enclosure fixtures, check
membership mutation/removal/serialization behavior, and benchmark the chosen
storage and reverse lookups. No implementation round closes or alpha scope
changes through this provisional answer. The remaining questions are listed in
[the interview follow-up register](2026-10-11-01-rnd0000-note-alpha-interview-open-questions.md).
