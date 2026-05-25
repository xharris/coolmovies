import { keepPreviousData, QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query"
import "./App.css"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { cx } from "./classnameswrap"
import { createBrowserRouter, Link, RouterProvider, useSearchParams } from "react-router"
import { FiAlertCircle, FiCheck, FiCircle, FiLoader, FiMenu, FiMinus, FiSquare, FiX } from "react-icons/fi"
import { useForm } from "react-hook-form"
import { useDebounceValue, useLocalStorage } from "usehooks-ts"
import { api } from "./api"
import { wilson_score_lower } from "./math2"
import type { VantaEffect } from "vanta"

const THEMES = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "aqua",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "luxury",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset",
  "caramellatte",
  "abyss",
  "silk",
]

type Media = {
  id: string
  title: string
  year: number
  img?: string
  imdb_id?: string
  imdb_url?: string
  stats: {
    votes: Record<string, number>
  }
  rank?: number
}

type Tag = {
  id: string
  name: string
  description: string
  theme?: string
}

type EditTagBody = Omit<Tag, "id">

type TagVote = {
  media: string
  tag: string
  created_by: string
}

type AddMediaTagBody = {
  mediaId: string
  tagId: string
}

type AddTagBody = {
  tagName: string
}

type UserRole = "admin"

const useMediaFilter = () =>
  useLocalStorage("media-fiter", {
    excludeTags: [] as string[],
  })

const queryClient = new QueryClient()

export const useAllTags = () =>
  useQuery({
    queryKey: ["tag"],
    queryFn: () => api.get("/tag/all").json<Tag[]>(),
    placeholderData: keepPreviousData,
  })

const SEARCH_PLACEHOLDERS = [
  "Search for stuff...",
  "Find something else...",
  "What are we watching tonight...?",
  "Search for a vibe...",
  // "Find something to keep you up...",
  // "Looking for something trippy?",
  // "What are we playing tonight?",
]

const App = () => {
  const appRef = useRef<HTMLDivElement>(null)
  const searchPlaceholder = useState(
    () => SEARCH_PLACEHOLDERS[Math.floor(Math.random() * SEARCH_PLACEHOLDERS.length)],
  )[0]
  const { data: allTags } = useAllTags()
  const { data: allMedias } = useQuery({
    queryKey: ["media"],
    queryFn: () => api.get("/media/all").json<Media[]>(),
  })
  const { data: userCount } = useQuery({
    queryKey: ["user_count"],
    queryFn: () => api.get("/user/count").text().then(parseInt),
  })
  // media tag filter
  const [mediaFilter, setMediaFilter] = useMediaFilter()
  // search query
  const [params, setParams] = useSearchParams({ q: "" })
  const [query, setQueryState] = useState(() => params.get("q") ?? "")
  const setQuery = useCallback((value: string) => {
    setQueryState(value)
    setParams(
      (prev) => {
        if (!!value.length) {
          prev.set("q", value)
        } else {
          prev.delete("q")
        }
        return prev
      },
      { replace: true },
    )
  }, [])
  const [queryDebounced] = useDebounceValue(query, 200)
  // search results
  const { data: searchResults, isFetching: isSearchFetching } = useQuery({
    queryKey: ["media_search", { query: queryDebounced }],
    queryFn: () => api.post({ query: queryDebounced }, "/media/search").json<Media[]>(),
    enabled: !!queryDebounced.length,
    placeholderData: keepPreviousData,
    networkMode: "offlineFirst",
  })
  const [selectedMediaId, setSelectedMediaId] = useState<string>()
  const isSearching = useMemo(() => !!query.length && isSearchFetching, [query, isSearchFetching])
  const listMedias = useMemo(() => {
    let medias: Media[] = []
    if (!!query.length) {
      medias = searchResults ?? []
    } else if (allMedias) {
      medias = allMedias.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
    }
    return medias.filter((m) => {
      // has at least one tag that is not excluded
      if (!mediaFilter.excludeTags.length || !mediaFilter.excludeTags.filter((id) => !!m.stats.votes[id]).length) {
        return true
      }
      return false
    })
  }, [searchResults, allMedias, query, mediaFilter])
  const selectedMedia = useMemo(
    () => listMedias.find((m) => m.id === selectedMediaId) ?? searchResults?.find((m) => m.id === selectedMediaId),
    [selectedMediaId, listMedias, searchResults],
  )
  useEffect(() => {
    if (selectedMediaId && !selectedMedia) setSelectedMediaId(undefined)
  }, [selectedMedia, selectedMediaId])
  useEffect(() => {
    // add bg fog effect
    // https://www.vantajs.com/?effect=fog#(backgroundAlpha:1,baseColor:657930,blurFactor:0.18,gyroControls:!f,highlightColor:4604996,lowlightColor:2763306,midtoneColor:3947580,minHeight:200,minWidth:200,mouseControls:!t,scale:2,scaleMobile:4,speed:1,touchControls:!t,zoom:1)
    let isDisposed = false
    let effect: VantaEffect | undefined
    ;(async () => {
      const THREE = await import("three")
      const vantaWindow = window as Window & {
        THREE?: unknown
        VANTA?: { FOG?: (options: Record<string, unknown>) => VantaEffect }
      }
      vantaWindow.THREE = THREE

      await import("vanta/dist/vanta.fog.min")
      const fogFactory = vantaWindow.VANTA?.FOG

      if (!isDisposed && appRef.current && typeof fogFactory === "function") {
        effect = fogFactory({
          el: appRef.current,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          highlightColor: 0xa6a1a1,
          midtoneColor: 0x606060,
          lowlightColor: 0x2a2a2a,
          baseColor: 0xa0a0a,
          blurFactor: 0.18,
          zoom: 0.4,
        })
      }
    })()

    return () => {
      isDisposed = true
      effect?.destroy()
    }
  }, [])
  const enabledFiltersStatus = useMemo(() => {
    if (!allTags?.length) {
      return "none"
    }
    if (mediaFilter.excludeTags.length === 0) {
      return "all"
    }
    if (mediaFilter.excludeTags.length === allTags.length) {
      return "none"
    }
    return "some"
  }, [mediaFilter, allTags])
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (!allMedias || !allTags) {
      return counts
    }
    const enabledTags = allTags.map((t) => t.id).filter((id) => !mediaFilter.excludeTags.includes(id))
    for (const tag of allTags) {
      const possibleMedias = allMedias.filter(
        (m) =>
          // has this tag
          !!m.stats.votes[tag.id] &&
          // has at least one tag that isn't excluded
          Object.keys(m.stats.votes).some((id) => !!m.stats.votes[id] && enabledTags.includes(id)),
      )
      // console.log(
      //   tag.name,
      //   possibleMedias.map((m) => m.title),
      // )
      counts[tag.id] = mediaFilter.excludeTags.includes(tag.id)
        ? possibleMedias.length
        : listMedias.filter((m) => !!m.stats.votes[tag.id]).length
    }
    return counts
  }, [allTags, allMedias, mediaFilter])

  return (
    <div id="app" ref={appRef} className="overflow-y-auto overflow-x-hidden absolute inset-0">
      <div className="mx-auto md:max-w-3xl w-full absolute inset-0 flex flex-col gap-3">
        <div className="navbar gap-2 pb-0">
          <div className="navbar-start flex-0">
            <button
              className={cx("btn btn-ghost text-lg uppercase w-38", isSearching && "text-primary animate-pulse")}
              onClick={() => setQuery("")}
            >
              {isSearching ? `coolmovies420` : `coolmovies4u`}
            </button>
          </div>
          <div className="navbar-center flex-1 gap-2">
            {/* search */}
            <input
              className="input flex-1 transition-all"
              type="text"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {/* menu */}
            <button
              className="btn btn-square"
              onClick={() => (document.getElementById("menu") as HTMLDialogElement).showModal()}
            >
              <FiMenu />
            </button>
            <MenuDialog />
          </div>
        </div>
        {/* filters */}
        <div className="inline-flex gap-2 px-3 flex-wrap">
          <button
            className="cursor-pointer"
            disabled={!allTags?.length}
            onClick={() =>
              enabledFiltersStatus === "none" || enabledFiltersStatus === "some"
                ? setMediaFilter({ excludeTags: [] })
                : setMediaFilter({
                    excludeTags: allTags?.map((t) => t.id) ?? [],
                  })
            }
          >
            <MediaTag
              label="Filters"
              className="opacity-50"
              checked={enabledFiltersStatus === "all"}
              icon={
                enabledFiltersStatus === "some" ? <FiMinus /> : enabledFiltersStatus === "none" ? <FiX /> : undefined
              }
              count={listMedias.length}
            />
          </button>
          {allMedias
            ? allTags?.map((t) => {
                const isEnabled = !mediaFilter.excludeTags.includes(t.id)
                return (
                  <button
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() =>
                      setMediaFilter((prev) => ({
                        ...prev,
                        excludeTags: isEnabled
                          ? [...prev.excludeTags, t.id]
                          : prev.excludeTags.filter((id) => id !== t.id),
                      }))
                    }
                    data-theme={isEnabled ? t.theme : undefined}
                  >
                    <MediaTag
                      key={t.id}
                      label={t.name}
                      checked={isEnabled}
                      primary={isEnabled}
                      icon={!isEnabled ? <FiX /> : null}
                      count={tagCounts[t.id]}
                      countShow1
                    />
                  </button>
                )
              })
            : null}
        </div>
        {/* list medias */}
        <div className="flex flex-col px-3 gap-2">
          {listMedias?.map((r) => {
            const notReleased = r.year > new Date().getFullYear()
            const topTag = allTags
              ?.filter((t) => !!r.stats.votes[t.id])
              .sort((a, b) => r.stats.votes[b.id] - r.stats.votes[a.id])
              .at(0)
            return (
              // media card
              <div key={r.id} className="p-3 bg-base-300 content-auto" data-theme={topTag?.theme}>
                <div className="bg-base-300 relative roundnd flex flex-col min-h-38 w-full">
                  {/* img */}
                  {r.img ? (
                    <div className="absolute inset-0 w-1/3">
                      <img src={r.img} className="w-full h-full object-cover object-[50%_33%] brightness-130 rounded" />
                    </div>
                  ) : null}
                  {/* info */}
                  <div className="z-10 leading-snug h-full flex gap-3">
                    <div className="w-1/3 shrink-0" />
                    <div className="flex flex-col justify-between w-full gap-1">
                      <div className="flex flex-col gap-1">
                        <div className="w-full">
                          {/* title */}
                          <button
                            onClick={() => setSelectedMediaId(r.id)}
                            className={cx("text-left", !notReleased && "cursor-pointer")}
                            disabled={notReleased}
                          >
                            <span className="text-2xl leading-tight text-left underline">{r.title}</span>
                            {/* year */}
                            <MediaTag
                              className="text-neutral-600! mx-1"
                              labelClassName="bg-neutral-300"
                              label={r.year}
                            />
                          </button>
                        </div>
                        <div className="inline-flex gap-1">
                          {/* urls */}
                          {r.imdb_url ? (
                            <Link to={r.imdb_url}>
                              <MediaTag label="IMDB" small />
                            </Link>
                          ) : null}
                          {/* not released */}
                          {notReleased ? <MediaTag label="Coming Soon" small icon={<FiAlertCircle />} /> : null}
                        </div>
                      </div>
                      {/* tags */}
                      <div className="w-full inline-flex gap-0.5 flex-wrap">
                        {allTags
                          ?.filter((t) => !!r.stats.votes[t.id])
                          .sort((a, b) => (r.stats.votes[b.id] ?? 0) - (r.stats.votes[a.id] ?? 0))
                          .map((t, idx) => {
                            return (
                              <MediaTag
                                key={t.id}
                                label={t.name}
                                count={r.stats.votes[t.id]}
                                barCount={Math.floor(
                                  (1 - wilson_score_lower(r.stats.votes[t.id] ?? 0, userCount ?? 0)) * 3,
                                )}
                                primary={idx === 0}
                              />
                            )
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {selectedMedia
          ? createPortal(
              <MediaDialog media={selectedMedia} onClose={() => setSelectedMediaId(undefined)} />,
              document.body,
            )
          : null}
      </div>
    </div>
  )
}

const MenuDialog = () => {
  const [selectedTagId, setSelectedTagId] = useState<string>()
  const { data: tags } = useAllTags()
  const { data: userRoles } = useQuery({
    queryKey: ["user_role"],
    queryFn: () => api.get("/user/roles").json<UserRole[]>(),
  })
  // api: add tag
  const { mutateAsync: addTag, isPending } = useMutation({
    mutationFn: (body: AddTagBody) => api.url(`/tag/add/${body.tagName}`).post().res(),
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const { register, handleSubmit } = useForm<AddTagBody>({
    values: { tagName: "" },
  })
  const {
    register: registerEditTag,
    handleSubmit: handleEditTagSubmit,
    formState,
    reset,
    watch,
  } = useForm<Tag>({
    defaultValues: {},
  })
  const { mutateAsync: saveTag } = useMutation({
    mutationFn: (body: EditTagBody) => api.post(body, `/tag/${selectedTagId}`).res(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tag"] })
      setSelectedTagId(undefined)
      reset()
    },
  })
  const selectedTag = useMemo(
    () => (selectedTagId && tags ? tags.find((t) => t.id === selectedTagId) : undefined),
    [selectedTagId, tags],
  )

  return (
    <dialog id="menu" className="modal">
      <div className="modal-box">
        <h3 className="text-lg font-bold">About</h3>
        <p className="text-4xl">{"Search for movies, shows, and anime using vibes. Games to be added soon."}</p>
        <p>xhh © 2026</p>
        {/* admin stuff */}
        {userRoles?.includes("admin") ? (
          <>
            <div className="divider" />
            {/* tag editor */}
            <div className="text-lg font-bold">Tags</div>
            <div className="inline-flex gap-1 flex-wrap">
              {tags?.map((t) => {
                const isSelected = selectedTagId === t.id
                return (
                  <button
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => {
                      if (!formState.isDirty || confirm("Discard changes?")) {
                        setSelectedTagId((prev) => (prev === t.id ? undefined : t.id))
                        reset(t)
                      }
                    }}
                    data-theme={isSelected ? watch("theme", t.theme) : undefined}
                  >
                    <MediaTag label={t.name} primary={isSelected} icon={selectedTagId === t.id ? <FiX /> : undefined} />
                  </button>
                )
              })}
            </div>
            {selectedTag ? (
              <form className="w-full flex flex-col gap-1" onSubmit={handleEditTagSubmit((v) => saveTag(v))}>
                <label className="input w-full">
                  <span className="label">Name</span>
                  <input {...registerEditTag("name")} type="text" />
                </label>
                <label className="input w-full">
                  <span className="label">Description</span>
                  <input {...registerEditTag("description")} type="text" />
                </label>
                <label className="select w-full">
                  <span className="label">Theme</span>
                  <select {...registerEditTag("theme")}>
                    {THEMES.sort().map((theme) => (
                      <option key={theme}>{theme}</option>
                    ))}
                  </select>
                </label>
                <button className="btn">Save</button>
              </form>
            ) : (
              /* add tag form */
              <form className="flex flex-col gap-2 w-full" onSubmit={handleSubmit((d) => addTag(d))}>
                {/* add tag input */}
                <label className="input w-full">
                  <span className="label">Add tag</span>
                  <input {...register("tagName", { required: true })} type="text" placeholder="Name" />
                </label>
                {/* add tag submit */}
                <button className="btn" disabled={isPending}>
                  Add
                </button>
              </form>
            )}
          </>
        ) : null}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>Close</button>
      </form>
    </dialog>
  )
}

type MediaTagProps = {
  label: ReactNode
  description?: string
  labelClassName?: string
  barCount?: number
  className?: string
  count?: number
  countShow1?: boolean
  small?: boolean
  checked?: boolean
  primary?: boolean
  isLoading?: boolean
  icon?: ReactNode
}

const MediaTag = ({
  label,
  description,
  labelClassName,
  barCount = 0,
  className,
  count = 0,
  countShow1,
  small,
  checked,
  primary,
  isLoading,
  icon,
}: MediaTagProps) => (
  <div
    className={cx(
      "inline-flex gap-0.5 transition-all",
      small && "text-sm",
      primary ? "text-primary-content" : "text-neutral-content",
      className,
    )}
  >
    <div
      className={cx(
        small ? "px-1 py-0.5" : "py-0.5 px-1.5",
        "flex-1 h-full flex items-center gap-0.5 transition-all",
        primary ? "bg-primary" : "bg-neutral",
        labelClassName,
      )}
    >
      <div className="flex flex-col items-start text-left flex-1">
        <div className="flex items-center gap-0.5">
          {isLoading ? (
            <FiLoader className="animate-spin stroke-2" />
          ) : checked ? (
            <FiCheck className="stroke-2" />
          ) : (
            icon
          )}
          <span className="capitalize">{label}</span>
          {count && (count > 1 || countShow1) ? <span>{count}</span> : null}
        </div>
        {!!description?.length ? <span className="text-sm leading-none">{description}</span> : null}
      </div>
    </div>
    {new Array(barCount).fill(0).map((_, i) => (
      <div key={i} className={cx("w-2 h-full transition-all", primary ? "bg-primary" : "bg-neutral", labelClassName)} />
    ))}
  </div>
)

type MediaDialogProps = {
  media: Media
  onClose?: () => void
}

const MediaDialog = ({ media, onClose }: MediaDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null)
  const { data: allTags } = useAllTags()
  const { data: tagVotes } = useQuery({
    queryKey: ["tagvote", media.id],
    queryFn: () => api.get(`/media/${media.id}/tagvotes`).json<TagVote[]>(),
  })
  useEffect(() => {
    if (ref.current) {
      ref.current.showModal()
    }
  }, [ref])

  return (
    <dialog ref={ref} id="media-dialog" className="modal" onClose={onClose}>
      <div className="modal-box flex flex-col gap-2">
        <h3 className="text-3xl">{media.title}</h3>
        <h4 className="text-sm italic">Click any tags you think match the vibe</h4>
        <div className="grid grid-cols-2 gap-2">
          {/* vote on tags */}
          {allTags?.map((t) => {
            const hasVoted = tagVotes?.some((v) => t.id === v.tag && media.id === v.media)
            return (
              <MediaTagVoteButton
                key={t.id}
                media={media}
                tag={t}
                mediaTagProps={{
                  className: "text-4xl w-full h-full items-start",
                  checked: hasVoted,
                  primary: hasVoted,
                  description: t.description,
                }}
                hasVoted={hasVoted}
              />
            )
          })}
        </div>
        <div className="model-action">
          <form method="dialog" className="w-full flex justify-end">
            <button className="btn">Close</button>
          </form>
        </div>
      </div>
    </dialog>
  )
}

type MediaTagVoteButtonProps = {
  media: Media
  tag: Tag
  mediaTagProps: Omit<MediaTagProps, "label">
  hasVoted?: boolean
}

const MediaTagVoteButton = ({ media, tag, mediaTagProps, hasVoted }: MediaTagVoteButtonProps) => {
  // api: add/remove tag from media
  const { mutateAsync: addMediaTag, isPending: isAddMediaTagPending } = useMutation({
    mutationFn: (body: AddMediaTagBody) => api.url(`/media/${body.mediaId}/addtag/${body.tagId}`).put().res(),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tagvote", media.id] })
      queryClient.invalidateQueries({ queryKey: ["media"] })
      queryClient.invalidateQueries({ queryKey: ["media_search"] })
    },
  })
  const { mutateAsync: removeMediaTag, isPending: isRemoveMediaTagPending } = useMutation({
    mutationFn: (body: AddMediaTagBody) => api.url(`/media/${body.mediaId}/removetag/${body.tagId}`).put().res(),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tagvote", media.id] })
      queryClient.invalidateQueries({ queryKey: ["media"] })
      queryClient.invalidateQueries({ queryKey: ["media_search"] })
    },
  })
  const isPending = isAddMediaTagPending || isRemoveMediaTagPending

  return (
    <button
      className={cx(isPending ? "opacity-50" : "cursor-pointer")}
      onClick={() =>
        hasVoted
          ? removeMediaTag({ mediaId: media.id, tagId: tag.id })
          : addMediaTag({ mediaId: media.id, tagId: tag.id })
      }
      disabled={isPending}
      data-theme={!!media.stats.votes[tag.id] ? tag.theme : undefined}
    >
      <MediaTag
        {...mediaTagProps}
        label={tag.name}
        isLoading={isPending}
        count={media.stats.votes[tag.id] ?? 0}
        icon={hasVoted ? undefined : <FiSquare className="opacity-30" />}
      />
    </button>
  )
}

const router = createBrowserRouter([{ path: "/", element: <App /> }])

const Providers = () => (
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
)

export default Providers
