import {
  keepPreviousData,
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query"
import "./App.css"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { cx } from "./classnameswrap"
import {
  createBrowserRouter,
  Link,
  RouterProvider,
  useSearchParams,
} from "react-router"
import { FiCheck, FiLoader, FiMenu, FiX } from "react-icons/fi"
import { useForm } from "react-hook-form"
import { useDebounceValue, useLocalStorage } from "usehooks-ts"
import { api } from "./api"
import { wilson_score_lower } from "./math2"
import { FaTag } from "react-icons/fa"

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
}

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

const tagNameToTheme: Record<string, string> = {
  scary: "abyss",
  trippy: "synthwave",
  confusing: "sunset",
  relaxing: "coffee",
}
const getTheme = (tag?: Tag) =>
  tag && tagNameToTheme[tag.name] ? tagNameToTheme[tag.name] : undefined

const queryClient = new QueryClient()

export const useAllTags = () =>
  useQuery({
    queryKey: ["tag"],
    queryFn: () => api.get("/tag/all").json<Tag[]>(),
  })

const App = () => {
  const { data: userRoles } = useQuery({
    queryKey: ["user_role"],
    queryFn: () => api.get("/user/roles").json<UserRole[]>(),
  })
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
  const [mediaFilter, setMediaFilter] = useLocalStorage("media-fiter", {
    excludeTags: [] as string[],
  })
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
    queryFn: () =>
      api.post({ query: queryDebounced }, "/media/search").json<Media[]>(),
    enabled: !!queryDebounced.length,
    placeholderData: keepPreviousData,
    networkMode: "offlineFirst",
  })
  const [selectedMediaId, setSelectedMediaId] = useState<string>()
  const isSearching = useMemo(
    () => !!query.length && isSearchFetching,
    [query, isSearchFetching],
  )
  const listMedias = useMemo(() => {
    let medias: Media[] = []
    if (!!query.length) {
      medias = searchResults ?? []
    } else if (allMedias) {
      medias = allMedias.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
    }
    return medias.filter(
      (m) =>
        // does not have excluded tag
        !Object.keys(m.stats.votes).filter(
          (id) => mediaFilter.excludeTags.includes(id) && !!m.stats.votes[id],
        ).length,
    )
  }, [searchResults, allMedias, query, mediaFilter])
  const selectedMedia = useMemo(
    () =>
      listMedias.find((m) => m.id === selectedMediaId) ??
      searchResults?.find((m) => m.id === selectedMediaId),
    [selectedMediaId, listMedias, searchResults],
  )
  // api: add tag
  const { mutateAsync: addTag } = useMutation({
    mutationFn: (body: AddTagBody) =>
      api.url(`/tag/add/${body.tagName}`).post().res(),
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const { register, handleSubmit } = useForm<AddTagBody>({
    values: { tagName: "" },
  })

  return (
    <div className="overflow-y-auto overflow-x-hidden" data-theme="black">
      <div className="mx-auto md:max-w-2xl w-full absolute inset-0 flex flex-col gap-3">
        <div className="navbar gap-2 pb-0">
          <div className="navbar-start flex-0">
            <button
              className={cx(
                "btn btn-ghost text-lg uppercase",
                isSearching && "text-primary animate-pulse",
              )}
              onClick={() => setQuery("")}
            >
              coolmovies420
            </button>
          </div>
          <div className="navbar-center flex-1 gap-2">
            {/* search */}
            <input
              className="input flex-1 transition-all"
              type="text"
              placeholder="Search for stuff..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {/* menu */}
            <button
              className="btn btn-square"
              onClick={() =>
                (
                  document.getElementById("menu") as HTMLDialogElement
                ).showModal()
              }
            >
              <FiMenu />
            </button>
            <dialog id="menu" className="modal">
              <div className="modal-box">
                <h3 className="text-lg font-bold">About</h3>
                <p>Search for movies, shows, anime, and games using vibes.</p>
                <p>xhh © 2026</p>
                {/* add tag form */}
                {userRoles?.includes("admin") ? (
                  <form
                    className="flex flex-col gap-2 w-full"
                    onSubmit={handleSubmit((d) => addTag(d))}
                  >
                    {/* add tag input */}
                    <label className="input w-full">
                      <span className="label">Add tag</span>
                      <input
                        {...register("tagName", { required: true })}
                        type="text"
                        placeholder="Name"
                      />
                    </label>
                    {/* add tag submit */}
                    <button className="btn">Add</button>
                  </form>
                ) : null}
              </div>
              <form method="dialog" className="modal-backdrop">
                <button>Close</button>
              </form>
            </dialog>
          </div>
        </div>
        {/* filters */}
        <div className="inline-flex gap-2 px-3">
          <MediaTag label="Filters" className="opacity-50" />
          {allTags?.map((t) => {
            const isEnabled = !mediaFilter.excludeTags.includes(t.id)
            return (
              <button
                className="cursor-pointer"
                onClick={() =>
                  setMediaFilter((prev) => ({
                    ...prev,
                    excludeTags: isEnabled
                      ? [...prev.excludeTags, t.id]
                      : prev.excludeTags.filter((id) => id !== t.id),
                  }))
                }
                data-theme={isEnabled ? getTheme(t) : undefined}
              >
                <MediaTag
                  key={t.id}
                  label={t.name}
                  checked={isEnabled}
                  primary={isEnabled}
                  icon={!isEnabled ? <FiX /> : null}
                />
              </button>
            )
          })}
        </div>
        {/* search results */}
        <div className="flex flex-col px-3 gap-2">
          {listMedias?.map((r) => {
            const topTag = allTags
              ?.filter((t) => !!r.stats.votes[t.id])
              .sort((a, b) => r.stats.votes[b.id] - r.stats.votes[a.id])
              .at(0)
            return (
              <div
                key={r.id}
                className="p-3 bg-base-300 content-auto"
                data-theme={getTheme(topTag)}
              >
                <div className="bg-base-300 relative roundnd flex flex-col min-h-38 w-full">
                  {/* img */}
                  {r.img ? (
                    <div className="absolute inset-0 w-1/3">
                      <img
                        src={r.img}
                        className="w-full h-full object-cover object-[50%_33%] brightness-130 rounded"
                      />
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
                            className="text-left cursor-pointer"
                          >
                            <span className="text-2xl leading-tight text-left">
                              {r.title}
                            </span>
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
                        </div>
                      </div>
                      {/* tags */}
                      <div className="w-full inline-flex gap-0.5">
                        {allTags
                          ?.filter((t) => !!r.stats.votes[t.id])
                          .sort(
                            (a, b) =>
                              (r.stats.votes[b.id] ?? 0) -
                              (r.stats.votes[a.id] ?? 0),
                          )
                          .map((t, idx) => {
                            return (
                              <MediaTag
                                key={t.id}
                                label={t.name}
                                voteCount={r.stats.votes[t.id]}
                                barCount={Math.floor(
                                  (1 -
                                    wilson_score_lower(
                                      r.stats.votes[t.id] ?? 0,
                                      userCount ?? 0,
                                    )) *
                                    3,
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
        {selectedMedia ? (
          <MediaDialog
            media={selectedMedia}
            onClose={() => setSelectedMediaId(undefined)}
          />
        ) : null}
      </div>
    </div>
  )
}

type MediaTagProps = {
  label: ReactNode
  labelClassName?: string
  barCount?: number
  className?: string
  voteCount?: number
  small?: boolean
  checked?: boolean
  primary?: boolean
  isLoading?: boolean
  icon?: ReactNode
}

const MediaTag = ({
  label,
  labelClassName,
  barCount = 0,
  className,
  voteCount = 0,
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
        small ? "px-1" : "py-0.5 px-1.5",
        "h-full flex items-center gap-0.5 transition-all",
        primary ? "bg-primary" : "bg-neutral",
        labelClassName,
      )}
    >
      {isLoading ? (
        <FiLoader className="animate-spin stroke-2" />
      ) : checked ? (
        <FiCheck className="stroke-2" />
      ) : (
        icon
      )}
      <span className="capitalize">{label}</span>
      {voteCount && voteCount > 1 ? <span>{voteCount}</span> : null}
    </div>
    {new Array(barCount).fill(0).map((_, i) => (
      <div
        key={i}
        className={cx(
          "w-2 h-full transition-all",
          primary ? "bg-primary" : "bg-neutral",
          labelClassName,
        )}
      />
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
        <h3 className="text-xl">{media.title}</h3>
        <div className="inline-flex gap-2 flex-wrap">
          {/* vote on tags */}
          {allTags?.map((t) => {
            const hasVoted = tagVotes?.some(
              (v) => t.id === v.tag && media.id === v.media,
            )
            return (
              <MediaTagVoteButton
                key={t.id}
                media={media}
                tag={t}
                mediaTagProps={{
                  className: "text-4xl",
                  checked: hasVoted,
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

const MediaTagVoteButton = ({
  media,
  tag,
  mediaTagProps,
  hasVoted,
}: MediaTagVoteButtonProps) => {
  // api: add/remove tag from media
  const { mutateAsync: addMediaTag, isPending: isAddMediaTagPending } =
    useMutation({
      mutationFn: (body: AddMediaTagBody) =>
        api.url(`/media/${body.mediaId}/addtag/${body.tagId}`).put().res(),
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["tagvote", media.id] })
        queryClient.invalidateQueries({ queryKey: ["media"] })
        queryClient.invalidateQueries({ queryKey: ["media_search"] })
      },
    })
  const { mutateAsync: removeMediaTag, isPending: isRemoveMediaTagPending } =
    useMutation({
      mutationFn: (body: AddMediaTagBody) =>
        api.url(`/media/${body.mediaId}/removetag/${body.tagId}`).put().res(),
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
    >
      <MediaTag
        {...mediaTagProps}
        label={tag.name}
        isLoading={isPending}
        voteCount={media.stats.votes[tag.id] ?? 0}
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
