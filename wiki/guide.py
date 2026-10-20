"""Guide pas à pas de l’assistant de révision (S26) : du compte OpenRouter à la première question.

Les écrans d’OpenRouter changent sans préavis : les étapes décrivent ce qu’il faut faire sans recopier de libellé
non vérifié, et les montants restent des ordres de grandeur renvoyés à l’affichage d’OpenRouter."""
from html import escape as h

TITLE = "Assistant IA : guide pas à pas"
OPENROUTER = '<a href="https://openrouter.ai/" target="_blank" rel="noopener noreferrer">openrouter.ai</a>'
EXAMPLES = ("Pourquoi préchauffe-t-on certains aciers avant soudage ?",
            "Que mesure l’essai Charpy, et pourquoi à plusieurs températures ?",
            "Comment lire un cercle de Mohr ?",
            "Quelle différence entre brasage fort et brasage tendre ?")
STEPS = ("Créer le compte", "Ajouter des crédits", "Se connecter depuis le wiki", "Protéger sa clé", "Poser une question", "Lire la réponse")


def step(number, title, body):
    return f'<li class="guide-step" id="etape-{number}"><h2><span class="guide-num" aria-hidden="true">{number}</span>{title}</h2>{body}</li>'


def render_guide():
    nav = "".join(f'<li><a href="#etape-{n}">{label}</a></li>' for n, label in enumerate(STEPS, 1))
    examples = "".join(f'<li><button type="button" class="guide-ask" data-chat-open="{h(q)}">{h(q)}</button></li>' for q in EXAMPLES)
    steps = [
        step(1, "Créer votre compte OpenRouter", f"""
<p class="guide-why">OpenRouter donne accès, avec un seul compte, aux modèles de plusieurs fournisseurs (OpenAI, Anthropic, Mistral…). Le wiki n’a pas de serveur : c’est votre compte qui paie vos questions.</p>
<ol class="guide-do"><li>Ouvrez {OPENROUTER} dans un nouvel onglet et choisissez de créer un compte (<span lang="en">Sign up</span>).</li>
<li>Inscrivez-vous avec Google, GitHub ou une adresse e-mail.</li>
<li>Si un e-mail de vérification arrive, ouvrez-le pour activer le compte.</li></ol>
<p class="guide-check">Vous êtes connecté sur openrouter.ai.</p>
<p class="guide-tip">Le site d’OpenRouter est en anglais. Gardez cet onglet du wiki ouvert pour suivre le guide.</p>"""),
        step(2, "Ajouter des crédits", """
<p class="guide-why">Les modèles proposés sont payants. OpenRouter fonctionne avec des crédits prépayés, en dollars : rien n’est prélevé au-delà de ce que vous avez acheté.</p>
<ol class="guide-do"><li>Dans votre compte OpenRouter, ouvrez les réglages, rubrique des crédits (<span lang="en">Credits</span>).</li>
<li>Achetez un petit montant : 5 $ suffisent largement pour commencer. Le paiement se fait par carte bancaire ou en cryptomonnaie.</li>
<li>Vérifiez le total avant de payer : OpenRouter ajoute des frais d’achat, affichés à ce moment-là.</li></ol>
<p class="guide-check">Votre solde de crédits apparaît dans votre compte.</p>
<p class="guide-tip"><strong>Ordre de grandeur :</strong> avec le modèle par défaut, une question coûte de l’ordre d’un à deux centimes ; davantage avec une recherche web, le cours entier en contexte ou un modèle haut de gamme. Quelques dollars permettent donc plusieurs centaines de questions. Le coût exact s’affiche sous chaque réponse.</p>
<p class="guide-warn">Laissez le rechargement automatique désactivé si vous voulez garder la maîtrise de vos dépenses.</p>"""),
        step(3, "Connecter le wiki à votre compte", """
<p class="guide-why">La connexion crée pour le wiki une clé d’accès à votre compte, gardée uniquement dans ce navigateur. Vous n’avez aucun code à copier.</p>
<ol class="guide-do"><li>Sur n’importe quelle page du wiki, touchez le bouton <span class="guide-launcher">Chat</span> en bas à droite ; sur téléphone, il se trouve juste au-dessus de « Menu ».</li>
<li>Choisissez « Se connecter avec OpenRouter ».</li>
<li>Sur la page d’OpenRouter, connectez-vous si besoin, puis acceptez la demande d’autorisation du wiki (pemcode.github.io).</li>
<li>Vous revenez automatiquement sur la page de départ, au même endroit.</li></ol>
<p class="guide-check">Le chat affiche « Connecté à OpenRouter. Posez votre question. »</p>
<p class="guide-tip">La connexion vaut pour un appareil et un navigateur : refaites cette étape sur votre téléphone et sur votre ordinateur.</p>
<p class="guide-warn">Terminez la connexion dans le même navigateur, en moins de quinze minutes. Sinon, recommencez simplement depuis le bouton « Chat ».</p>
<p><button type="button" class="guide-open" data-chat-open>Ouvrir l’assistant ici</button></p>"""),
        step(4, "Protéger votre clé <small>(recommandé)</small>", """
<p class="guide-why">La clé créée permet de dépenser vos crédits. Elle ne quitte pas votre navigateur, mais mieux vaut limiter les dégâts en cas d’oubli sur un ordinateur partagé.</p>
<ol class="guide-do"><li>Ne gardez qu’un petit solde de crédits : c’est la protection la plus simple.</li>
<li>Dans les réglages de votre compte OpenRouter, la rubrique des clés (<span lang="en">Keys</span>) permet de fixer une limite de crédit à la clé utilisée par le wiki, ou de la supprimer.</li>
<li>Sur un ordinateur partagé, choisissez « Se déconnecter » dans le menu « … » du chat après usage, puis supprimez la clé dans cette même rubrique.</li></ol>
<p class="guide-tip">« Se déconnecter » efface la clé de ce navigateur ; la supprimer chez OpenRouter la rend inutilisable partout.</p>"""),
        step(5, "Poser votre première question", f"""
<ol class="guide-do"><li>Ouvrez le chat. Toutes ses commandes tiennent dans la barre sous le champ de question. Le modèle GPT-6.1 Sol y est choisi par défaut ; la liste ne propose que les modèles réellement disponibles chez OpenRouter.</li>
<li>Écrivez votre question et validez avec Entrée (Maj+Entrée pour aller à la ligne).</li>
<li>Pour parler d’un passage précis, sélectionnez-le dans le cours <em>avant</em> d’ouvrir le chat : il est envoyé en priorité.</li>
<li>Pour une question de synthèse, activez « Cours » dans la barre (tout le cours en contexte) : chaque question emporte alors le cours entier de la page. Elle coûte nettement plus cher ; le chat affiche une estimation des tokens envoyés.</li>
<li>Pour montrer une figure ou un exercice, collez une capture d’écran dans le champ (Ctrl+V) ou utilisez le trombone. Choisissez un modèle qui lit les images : le chat vous prévient sinon.</li>
<li>Le menu « … » de la barre donne accès à une « Nouvelle conversation », au guide, à la déconnexion et aux « Consignes », qui permettent de réécrire les instructions données à l’assistant (longueur des réponses, ton, langue…). Votre version ne vaut que dans ce navigateur ; « Rétablir les consignes d’origine » revient au réglage du wiki.</li></ol>
<p class="guide-label">Essayez une question : un clic la place dans le chat, rien n’est envoyé avant que vous validiez.</p>
<ul class="guide-examples">{examples}</ul>
<p class="guide-tip">L’assistant répond en 120 mots au plus, sauf pour un calcul. Il se souvient des trois derniers échanges : vous pouvez enchaîner avec « et pour un acier inoxydable ? ». « Nouvelle conversation », dans le menu « … », repart de zéro.</p>"""),
        step(6, "Lire la réponse", """
<figure class="guide-demo"><figcaption>Exemple de réponse</figcaption>
<p>Le préchauffage ralentit le refroidissement de la zone affectée thermiquement et limite la formation de martensite <span class="guide-cite">[MET-03-S6]</span>.</p>
<p>Une valeur typique figure dans une norme <span class="guide-cite">[EN-1011-2]</span> <span class="guide-unverified">source non vérifiée</span></p>
<p class="guide-small">Sources web : <span class="guide-cite">TWI — Preheat</span></p>
<p class="guide-small guide-muted">GPT-6.1 Sol · 2 300 tokens · 0,0068 $</p></figure>
<dl class="guide-legend">
<dt><span class="guide-cite">[MET-03-S6]</span></dt><dd>Identifiant d’une section du wiki : cliquez pour l’ouvrir et vérifier ce que dit le cours.</dd>
<dt><span class="guide-unverified">source non vérifiée</span></dt><dd>Le modèle cite un identifiant qui ne figurait pas dans les extraits envoyés : vérifiez vous-même avant de vous y fier.</dd>
<dt><span class="guide-badge">Hors cours</span></dt><dd>La réponse vient des connaissances générales du modèle, pas des cours. Le lien « Vérifier sur le web », sous la réponse, relance la question avec une recherche et ses sources.</dd>
<dt>Sources web</dt><dd>Pages consultées lors d’une recherche web, limitée à des sites de référence (IIW, TWI, ISO, AFNOR, AWS, INRS).</dd>
<dt>Extraits envoyés</dt><dd>La liste dépliable des sections du wiki que l’assistant a reçues avec votre question.</dd>
<dt>Ligne grise</dt><dd>Modèle, tokens et coût de la réponse, débités de votre compte OpenRouter.</dd></dl>
<p class="guide-warn">Comme toute IA, l’assistant peut se tromper. Les cours et vos enseignants font foi.</p>"""),
    ]
    return f"""<p class="wiki-eyebrow">Guide · environ 10 minutes</p>
<h1>Réviser avec l’assistant IA</h1>
<p class="wiki-lead">De la création de votre compte OpenRouter à votre première question, en six étapes. L’assistant répond à partir des cours du wiki et cite les sections qu’il utilise.</p>
<div class="guide-state"><p class="guide-off"><strong>Cet appareil n’est pas encore connecté.</strong> Suivez les étapes 1 à 3, puis posez votre question.</p>
<p class="guide-on"><strong>Cet appareil est connecté à OpenRouter.</strong> Passez directement à l’<a href="#etape-5">étape 5</a>.</p>
<button type="button" class="guide-open" data-chat-open>Ouvrir l’assistant</button>
<noscript><p>L’assistant demande JavaScript : activez-le pour l’utiliser.</p></noscript></div>
<ul class="guide-facts"><li><strong>Votre compte, vos crédits</strong><span>Chaque question est facturée sur votre compte OpenRouter, de l’ordre d’un à deux centimes avec le modèle par défaut.</span></li>
<li><strong>Des réponses citées</strong><span>Les identifiants comme <span class="guide-nowrap">[RDM-04-C3]</span> mènent à la section du cours utilisée.</span></li>
<li><strong>Aucun serveur</strong><span>Le wiki ne reçoit ni vos questions ni votre clé : tout passe directement de votre navigateur à OpenRouter.</span></li></ul>
<nav class="guide-nav" aria-label="Étapes du guide"><ol>{nav}</ol></nav>
<ol class="guide-steps">{"".join(steps)}</ol>
<section class="guide-more" id="confidentialite"><h2>Ce qui est envoyé, ce qui est gardé</h2>
<ul><li><strong>Envoyé à OpenRouter et au fournisseur du modèle :</strong> les consignes de l’assistant, votre question et ses images jointes, le texte sélectionné, jusqu’à trois extraits des cours (et le cours entier si vous l’avez activé) et les trois derniers échanges.</li>
<li><strong>Gardé dans ce navigateur :</strong> la clé jusqu’à la déconnexion, le modèle choisi, le réglage « Tout le cours en contexte », vos consignes personnalisées, et la conversation le temps de l’onglet (les images n’y restent qu’en vignettes).</li>
<li><strong>Jamais envoyé au wiki :</strong> il n’a pas de serveur ; ni ses auteurs ni la promo ne voient vos questions.</li>
<li>N’écrivez pas d’informations personnelles dans vos questions.</li></ul></section>
<section class="guide-more" id="depannage"><h2>En cas de problème</h2><dl class="guide-legend">
<dt>« Reconnectez-vous »</dt><dd>La clé a expiré ou a été supprimée : refaites l’<a href="#etape-3">étape 3</a>.</dd>
<dt>« Crédits OpenRouter insuffisants »</dt><dd>Rechargez votre compte (<a href="#etape-2">étape 2</a>) ou choisissez un modèle moins coûteux.</dd>
<dt>« Trop de requêtes »</dt><dd>Patientez quelques secondes, puis reposez la question.</dd>
<dt>« Connexion à OpenRouter impossible »</dt><dd>Vérifiez votre connexion internet ; certains réseaux d’établissement bloquent openrouter.ai.</dd>
<dt>« Ce modèle n’est pas disponible »</dt><dd>Choisissez-en un autre dans la liste du chat.</dd>
<dt>« … ne lit pas les images »</dt><dd>Choisissez l’un des modèles compatibles cités par le message, ou retirez l’image.</dd>
<dt>Réponses inattendues</dt><dd>Si vous avez modifié les consignes, ouvrez « Consignes » dans le menu « … » et choisissez « Rétablir les consignes d’origine ».</dd>
<dt>Retour sur le wiki sans être connecté</dt><dd>Terminez la connexion dans le même navigateur, en moins de quinze minutes, puis réessayez.</dd>
<dt>Pas de bouton « Chat »</dt><dd>JavaScript est désactivé ou bloqué par une extension : autorisez-le pour ce site et rechargez la page.</dd></dl></section>"""
