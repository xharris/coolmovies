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
import { FiCheck, FiLoader, FiMenu, FiPlus } from "react-icons/fi"
import { useForm } from "react-hook-form"
import { useDebounceValue } from "usehooks-ts"
import { api } from "./api"
import { wilson_score_lower } from "./math2"

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

const queryClient = new QueryClient()

export const useAllTags = () =>
  useQuery({
    queryKey: ["tag"],
    queryFn: () => api.get("/tag/all").json<Tag[]>(),
  })

const App = () => {
  const { data: allTags } = useAllTags()
  const { data: allMedias } = useQuery({
    queryKey: ["media"],
    queryFn: () => api.get("/media/all").json<Media[]>(),
  })
  const { data: userCount } = useQuery({
    queryKey: ["user_count"],
    queryFn: () => api.get("/user/count").text().then(parseInt),
  })
  // search query
  const [params, setParams] = useSearchParams({ q: "" })
  const [query, setQueryState] = useState(() => params.get("q") ?? "")
  const setQuery = useCallback((value: string) => {
    setQueryState(value)
    setParams(
      (prev) => {
        prev.set("q", value)
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
      medias = allMedias
    }
    return medias
  }, [searchResults, allMedias, query])
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
    <div className="overflow-y-auto mx-auto overflow-x-hidden md:max-w-2xl w-full absolute inset-0 flex flex-col gap-3">
      <div className="navbar gap-2 pb-0">
        <div className="navbar-start flex-0">
          <a
            className={cx(
              "btn btn-ghost text-lg uppercase",
              isSearching && "text-primary animate-pulse",
            )}
          >
            coolmovies420
          </a>
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
              (document.getElementById("menu") as HTMLDialogElement).showModal()
            }
          >
            <FiMenu />
          </button>
          <dialog id="menu" className="modal">
            <div className="modal-box">
              <h3 className="text-lg font-bold">Menu</h3>
              {/* add tag form */}
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
        {allTags?.map((t) => (
          <MediaTag key={t.id} label={t.name} />
        ))}
      </div>
      {/* search results */}
      <div className="flex flex-col px-3 gap-2">
        {listMedias?.map((r) => {
          const totalVotes = Object.values(r.stats.votes).reduce(
            (prev, curr) => prev + curr,
            0,
          )
          return (
            <div key={r.id} className="p-3 bg-base-300">
              <div className="bg-base-300 relative rounded flex flex-col min-h-24 w-full">
                {/* img */}
                {r.img ? (
                  <div className="absolute inset-0 w-1/3">
                    <img
                      src={r.img}
                      className="w-full h-full object-cover brightness-125 rounded"
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
}: MediaTagProps) => (
  <div
    className={cx(
      "inline-flex gap-0.5",
      small && "text-sm",
      primary ? "text-primary-content" : "text-neutral-content",
      className,
    )}
  >
    <div
      className={cx(
        small ? "px-1" : "py-0.5 px-1.5",
        "h-full flex items-center gap-0.5",
        primary ? "bg-primary" : "bg-neutral",
        labelClassName,
      )}
    >
      {isLoading ? (
        <FiLoader className="animate-spin stroke-2" />
      ) : checked ? (
        <FiCheck className="stroke-2" />
      ) : null}
      <span className="capitalize">{label}</span>
      {voteCount && voteCount > 1 ? <span>{voteCount}</span> : null}
    </div>
    {new Array(barCount).fill(0).map((_, i) => (
      <div
        key={i}
        className={cx(
          "w-2 h-full",
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
