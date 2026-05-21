import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query"
import "./App.css"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { ApiRequest } from "./api"
import { cx } from "./classnameswrap"
import { createBrowserRouter, Link, RouterProvider } from "react-router"
import { FiCheck, FiMenu, FiPlus } from "react-icons/fi"
import { useForm } from "react-hook-form"

type Media = {
  id: string
  title: string
  year: number
  img?: string
  imdb_id?: string
  imdb_url?: string
}

type AddMediaTagBody = {
  mediaId: string
  tagId: string
}

type AddTagBody = {
  tagName: string
}

const apiClient = new ApiRequest("http://localhost:8000/api/")
const queryClient = new QueryClient()

const App = () => {
  const [query, setQuery] = useState("")
  const { data: searchResults } = useQuery({
    queryKey: ["media_search", { query }],
    queryFn: () =>
      apiClient.post("media/search", { query }).response().json<Media[]>(),
    enabled: !!query.length,
  })
  const [selectedMedia, setSelectedMedia] = useState<Media>()
  // api: add to to media
  const { mutateAsync: addMediaTag } = useMutation({
    mutationFn: (body: AddMediaTagBody) =>
      apiClient
        .put(`media/${body.mediaId}/addtag/${body.tagId}`)
        .response()
        .json(),
    onSuccess: () => queryClient.invalidateQueries(),
  })
  // api: add tag
  const { mutateAsync: addTag } = useMutation({
    mutationFn: (body: AddTagBody) =>
      apiClient.post(`tag/add/${body.tagName}`).response().do(),
  })
  const { register, handleSubmit } = useForm<AddTagBody>({
    values: { tagName: "" },
  })

  return (
    <div className="overflow-y-auto mx-auto overflow-x-hidden md:max-w-2xl w-full absolute inset-0 flex flex-col gap-3">
      <div className="navbar gap-2 pb-0">
        <div className="navbar-start flex-0">
          <a className="btn btn-ghost text-lg uppercase">coolmovies420</a>
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
        <MediaTag label="Scary" voteCount={34} checked primary />
        <MediaTag label="Relaxing" voteCount={4200} />
      </div>
      {/* search results */}
      <div className="flex flex-col px-3 gap-2">
        {searchResults?.map((r) => (
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
                        onClick={() => setSelectedMedia(r)}
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
                    <MediaTag label="Scary" primary barCount={2} />
                    <MediaTag label="Relaxing" barCount={1} voteCount={42} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {selectedMedia ? (
        <MediaDialog
          media={selectedMedia}
          onClose={() => setSelectedMedia(undefined)}
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
      {checked ? <FiCheck className="stroke-2" /> : null}
      <span>{label}</span>
      {voteCount ? <span>{voteCount}</span> : null}
    </div>
    {/* {voteCount > 1 ? (
      <div
        className={cx(
          labelClassName,
          "h-full px-1.5 text-sm flex items-center justify-center",
        )}
      >
        <FiPlus />
        <span>{voteCount}</span>
      </div>
    ) : null} */}
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
  useEffect(() => {
    if (ref.current) {
      ref.current.showModal()
    }
  }, [ref])
  return (
    <dialog ref={ref} id="media-dialog" className="modal" onClose={onClose}>
      <div className="modal-box flex flex-col gap-2">
        <h3 className="text-xl">{media.title}</h3>
        <div className="inline-flex gap-2">
          {/* TODO vote on tags */}
          <label className="label">
            <input type="checkbox" hidden />
            <MediaTag label="Scary" className="text-4xl" />
          </label>
          <label className="label">
            <input type="checkbox" hidden />
            <MediaTag label="Relaxing" className="text-4xl" primary checked />
          </label>
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

const router = createBrowserRouter([{ path: "/", element: <App /> }])

const Providers = () => (
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
)

export default Providers
