from math import log1p, sqrt
from . import model


def wilson_score_lower(c: int, n: int, z: float = 1.96) -> float:
    if n <= 0:
        return 0.0
    p = c / n
    return (p + z**2 / (2*n) - z * sqrt((p*(1-p))/n + z**2/(4*n**2))) / (1 + z**2/n)

def compute_rank(media: model.Media, user_count: int) -> float:
    if not media.stats.votes or user_count == 0:
        return 0.0
    # sum wilson scores weighted by log of vote count
    # rewards media with many tags each voted by large fraction of users
    return sum(
        wilson_score_lower(votes, user_count) * log1p(votes)
        for votes in media.stats.votes.values()
        if votes > 0
    )
