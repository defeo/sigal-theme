import Vue from './vue.esm.browser.js';
import VueRouter from './vue-router.esm.browser.js';

Vue.use(VueRouter)

const Picture = {
    props: ['media', 'ord', 'prev', 'next'],
    template: `<div class="picture"><div>
 <router-link class="nav left" tag="button" v-show="prev !== null" :to="{ name: 'view', params: { ord: prev } }">〈</router-link>
 <router-link class="nav right" tag="button" v-show="next !== null" :to="{ name: 'view', params: { ord: next } }">〉</router-link>
 <transition name="slide">
  <img class="view" v-if="media.type == 'image'" :src="media.url" :alt="media.title" :key="ord">
  <video class="view" v-else-if="media.type == 'video'" :src="media.url" :type="media.mime" :key="ord"></video>
  <a class="view" v-else :href="media.url" download="true" :key="ord">↓</a>
 </transition>
</div></div>`,
}

const Thumb = {
    props: ['media', 'ord', 'iscurrent'],
    template: `<div class="thumb" :class="{ iscurrent }">
 <router-link tag="span" :to="{ name: 'view', params: { ord } }">
  <img :data-src="media.thumbnail" :alt="media.title">
 </router-link>
</div>`,
    mounted: function() {
	Vue.nextTick(() => {
	    this.$parent.$observer.observe(this.$el.querySelector('img'));
	    this.scrollIntoView();
	});
    },
    unmounted: function() {
	this.$parent.$observer.unobserve(this.$el.querySelector('img'));
    },
    updated: function() {
	this.scrollIntoView();
    },
    methods: {
	scrollIntoView: function() {
	    if (this.iscurrent)
		this.$el.scrollIntoView({ behaviour: 'smooth', inline: 'center' });
	},
    },
}

const Thumbnails = {
    props: ['media', 'current'],
    template: `<div class="thumbnails" @wheel="scroll">
 <sigal-thumb v-for="(m, i) in media" :key="i" :media="m" :ord="i" :iscurrent="i === current"></sigal-thumb>
</div>`,
    components: {
	'sigal-thumb': Thumb,
    },
    mounted: function() {
	this.$observer = new IntersectionObserver(entries => {
	    entries.forEach(e => e.target.src = e.isIntersecting ? e.target.dataset.src : "");
	}, {
	    root: this.$el,
	    threshold: 0.5,
	});
    },
    destroyed: function() {
	this.$observer.disconnect();
    },
    methods: {
	scroll: function(e) {
	    this.$el.scrollBy({ left: e.deltaY * 10, behaviour: 'smooth' });
	},
    },
}

const Map = {
    props: ['album', 'current', 'ord'],
    template: `<div class="map">
</div>`,
    mounted: function() {
	// todo, determine center when none is given
	this.$map = L.map(this.$el, {
	    center: this.current.exif.gps,
	    zoom: 13,
	});
	L.tileLayer.provider(this.album.settings.leaflet_provider).addTo(this.$map);

	const tooltip = (media) => {
	    const tt = document.createElement('div');
	    tt.innerHTML = `<p>
 ${(media.exif.datetime ? new Date(media.exif.datetime).toLocaleString() : media.description) || media.url}
</p>
<figure class="thumb iscurrent"><img data-src="${media.thumbnail || media.url}" alt=""></figure>`;
	    return tt;
	}
	
	this.$markers = this.album.media.map((m, i) => {
	    const gps = m.exif && m.exif.gps;
	    return gps
		? L.circleMarker(gps, i == this.ord
				 ? { radius: 6, color: 'blue' }
				 : { radius: 2, color: 'rgba(0,0,255,0.4)' })
		.bindTooltip(tooltip(m))
		.on('tooltipopen', (e) => {
		    const img = e.target.getTooltip().getContent().querySelector('img');
		    img.src = img.dataset.src;
		})
		.on('click', (e) => {
		    this.$router.push({ name: 'view', params: { ord: i } });
		})
		.addTo(this.$map)
	    : null;
	});

    },
    watch: {
	ord: function(newOrd, oldOrd) {
	    if (this.current.exif && this.current.exif.gps) {
		this.$map.setView(this.current.exif.gps);
	    }
	    let m = this.$markers[oldOrd];
	    if (m) {
		m.setRadius(2);
		m.setStyle({ color: 'rgba(0,0,255,0.4)' });
	    }
	    m = this.$markers[newOrd];
	    if (m) {
		m.setRadius(6);
		m.setStyle({ color: 'blue' });
	    }
	},
    },
}

const Info = {
    props: ['media'],
    template: `<div class="info">
 <a :href="media.big_url || media.url" title="Download original" download>&#128190;</a>
 <h3 v-if="media.exif.datetime">{{ new Date(media.exif.datetime).toLocaleString() }}</h3>
 <p v-if="media.description">{{ media.description }}</h3>
 <p v-if="media.exif">Camera info</p>
 <ul>
  <li v-if="media.exif.Make || media.exif.Model">{{ media.exif.Make }} {{ media.exif.Model }}</li>
  <li v-if="media.exif.iso">ISO sensitivity: {{ media.exif.iso }}</li>
  <li v-if="media.exif.exposure">Shutter speed: {{ media.exif.exposure }}</li>
  <li v-if="media.exif.fstop">F-Stop: {{ media.exif.fstop }}</li>
  <li v-if="media.exif.focal">Focal distance: {{ media.exif.focal }}</li>
 </ul>
</div>`,
}

const Gallery = {
    props: ['album', 'current', 'ord'],
    template: `<div id="gallery">
 <div id="pic-pane" :style="{ 'flex-basis': album.settings.img_size[0] + 'px' }">
  <sigal-picture :media="current" :ord="ord" :prev="prev" :next="next"></sigal-picture>
  <sigal-thumbs :media="album.media" :current="ord"></sigal-thumbs>
 </div><div id="meta-pane">
  <sigal-info :media="current"></sigal-info>
  <sigal-map v-if="album.settings.show_map" :album="album" :current="current" :ord="ord"></sigal-map>
 </div>
</div>`,
    components: {
	'sigal-picture': Picture,
	'sigal-thumbs': Thumbnails,
	'sigal-info': Info,
	'sigal-map': Map,
    },
    computed: {
	prev: function() { return this.ord == 0 ? null : this.ord - 1 },
	next: function() { return this.ord == this.album.media.length - 1 ? null : this.ord + 1 },
    },
    updated: function () {
	// Poor man's preloading
	if (this.prev) {
	    (new Image(1,1)).src = this.album.media[this.prev].url;
	}
	if (this.next) {
	    (new Image(1,1)).src = this.album.media[this.next].url;
	}
    },
}

const album = JSON.parse(document.scripts.album.innerText);

const app = new Vue({
    router: new VueRouter({
        routes: [{
	    path: '/',
	    redirect: '/v/0',
	}, {
            path: '/v/:ord',
	    name: 'view',
            component: Gallery,
	    props: (route) => ({
		album: album,
		ord: parseInt(route.params.ord),
		current: album.media[route.params.ord],
	    }),
        }],
    }),
}).$mount('#album-view');

console.log(app);
